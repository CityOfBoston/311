// @flow
/* eslint camelcase: 0 */

import type { Context } from '.';
import type { Service } from '../services/Open311';
import type { IndexedCase } from '../services/Elasticsearch';
import type { Root as CaseRoot } from './case';

export const Schema = `
type LatLng {
  lat: Float!
  lng: Float!
}

input LatLngIn {
  lat: Float!
  lng: Float!
}

type CaseSearchResults {
  cases: [Case!]!
  query: String!
}

type Query {
  services: [Service!]!
  topServices(first: Int): [Service!]!
  servicesForDescription(text: String!, max: Int, threshold: Float): [Service!]!
  service(code: String!): Service
  case(id: String!): Case
  searchCases(query: String, topLeft: LatLngIn, bottomRight: LatLngIn): CaseSearchResults!
  geocoder: Geocoder!
}
`;

type SuggestionsArgs = {
  text: string,
  max: ?number,
  threshold: ?number,
};

type SearchCasesArgs = {
  query: ?string,
  topLeft: ?{
    lat: number,
    lng: number,
  },
  bottomRight: ?{
    lat: number,
    lng: number,
  },
};

type CaseSearchResults = {
  cases: Array<IndexedCase>,
  query: string,
};

// HACK(finh): We need a way to invalidate this cache.
let cachedTopServices: ?Promise<Array<Service>> = null;

// Top 10 non-seasonal requests as of 9/18/17
const TOP_SERVICE_CODES = [
  'PRKGENFORC',
  'STRCLEAN',
  'SCHDBLKITM',
  'REQPOTHL',
  'MTRECYDBI',
  'IMPSTRTRSH',
  'STRLGTOUT',
  'MISDMGSGN',
  'TFCSGNINSP',
  'SDWRPR',
];

async function serviceSuggestions(
  { open311, prediction }: Context,
  { text, max }: SuggestionsArgs
): Promise<Service[]> {
  const [suggestions, services] = await Promise.all([
    prediction.caseTypes(text),
    open311.services(),
  ]);

  const matchedServices: Service[] = [];
  suggestions.forEach(type => {
    const matchedService = services.find(
      ({ service_code }) => service_code === type
    );
    if (matchedService) {
      matchedServices.push(matchedService);
    }
  });

  return matchedServices.slice(0, max || 5);
}

export const resolvers = {
  Query: {
    services: (
      root: mixed,
      args: mixed,
      { open311 }: Context
    ): Promise<Service[]> => open311.services(),

    topServices: async (
      root: mixed,
      { first }: { first: ?number },
      { open311 }: Context
    ): Promise<Service[]> => {
      if (!cachedTopServices) {
        cachedTopServices = open311.services().catch(err => {
          cachedTopServices = null;
          throw err;
        });
      }
      return cachedTopServices.then(services =>
        services
          .filter(
            ({ service_code }) => TOP_SERVICE_CODES.indexOf(service_code) !== -1
          )
          .slice(0, first || TOP_SERVICE_CODES.length)
      );
    },

    servicesForDescription: (
      root: mixed,
      args: SuggestionsArgs,
      context: Context
    ): Promise<Service[]> => serviceSuggestions(context, args),

    service: (
      root: mixed,
      { code }: { code: string },
      { open311 }: Context
    ): Promise<?Service> => open311.service(code),

    case: (
      root: mixed,
      { id }: { id: string },
      { open311 }: Context
    ): Promise<?CaseRoot> => open311.request(id),

    searchCases: async (
      root: mixed,
      { query, topLeft, bottomRight }: SearchCasesArgs,
      { elasticsearch }: Context
    ): Promise<CaseSearchResults> => {
      const cases = await elasticsearch.searchCases(
        query,
        topLeft,
        bottomRight
      );

      return {
        cases,
        query: query || '',
      };
    },
    geocoder: () => ({}),
  },
};
