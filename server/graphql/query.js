// @flow

import type { Context } from '.';
import type { Service } from '../services/Open311';
import type { Root as Request } from './request';

export const Schema = `
type LatLng {
  lat: Float!
  lng: Float!
}

input LatLngIn {
  lat: Float!
  lng: Float!
}

type RequestsPage {
  requests: [Request!]!
  query: String!
  currentPage: Int!
  totalPages: Int!
}

type Query {
  services: [Service!]!
  servicesForDescription(text: String!, max: Int, threshold: Float): [Service!]!
  service(code: String!): Service
  request(id: String!): Request
  requests(page: Int, query: String, location: LatLngIn, radiusKm: Float): RequestsPage!
  geocoder: Geocoder!
}
`;

type SuggestionsArgs = {
  text: string,
  max: ?number,
  threshold: ?number,
}

type RequestsArgs = {
  page: ?number,
  query: ?string,
  location: ?{
    lat: number,
    lng: number,
  },
  radiusKm: ?number,
};

type RequestsPage = {
  requests: Request[],
  query: string,
  currentPage: number,
  totalPages: number,
};


const SUGGESTION_NAME_MAP = {
  'Needle Pickup': 'Needle Removal',
  'Sidewalk Repair (Make Safe)': 'Repair Sidewalk',
  'Request for Snow Plowing': 'SNOW PLOWING & SNOW ICE/CONTROL',
  'Parking Enforcement': 'PARKING COMPLAINTS',
  'Sign Repair': 'HP SIGN REQUEST',
  'Request for Pothole Repair': 'ROADWAY REPAIR',
};


async function serviceSuggestions({ open311, prediction }: Context, { text, max, threshold }: SuggestionsArgs): Promise<Service[]> {
  const [suggestions, services] = await Promise.all([prediction.caseTypes(text, threshold || 0), open311.services()]);

  const matchedServices: Service[] = [];
  // "type" here is the name of the service
  suggestions.forEach(({ type }) => {
    const matchedService = services.find(({ service_name: serviceName }) => serviceName && (serviceName.toLowerCase() === (SUGGESTION_NAME_MAP[type] || type).toLowerCase()));
    if (matchedService) {
      matchedServices.push(matchedService);
    }
  });

  return matchedServices.slice(0, max || 5);
}

export const resolvers = {
  Query: {
    services: (root: mixed, args: mixed, { open311 }: Context): Promise<Service[]> => open311.services(),
    servicesForDescription: (root: mixed, args: SuggestionsArgs, context: Context): Promise<Service[]> => serviceSuggestions(context, args),
    service: (root: mixed, { code }: { code: string }, { open311 }: Context): Promise<?Service> => open311.service(code),
    request: (root: mixed, { id }: { id: string }, { open311 }: Context): Promise<?Request> => open311.request(id),
    requests: async (root: mixed, { page, query, location, radiusKm }: RequestsArgs, { swiftype }: Context): Promise<RequestsPage> => {
      const { requests, info } = await swiftype.searchCases({ page, query, location, radiusKm });
      return {
        requests,
        query: info.query,
        currentPage: info.current_page,
        totalPages: info.num_pages,
      };
    },
    geocoder: () => ({}),
  },
};
