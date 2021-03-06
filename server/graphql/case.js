// @flow

import moment from 'moment-timezone';

import type { ServiceStub } from './service';
import type {
  ServiceRequest,
  ServiceRequestActivity,
  DetailedServiceRequest,
} from '../services/Open311';
import type { IndexedCase } from '../services/Elasticsearch';

export type Root = ServiceRequest | DetailedServiceRequest | IndexedCase;

export const Schema = `
type Case {
  id: String!
  service: Service!
  description: String
  status: String!
  statusNotes: String
  serviceNotice: String
  closureReason: String
  closureComment: String
  address: String
  images: [CaseImage!]!
  location: LatLng
  requestedAt: Int
  updatedAt: Int
  expectedAt: Int
  requestedAtString(format: String): String
  updatedAtString(format: String): String
  expectedAtString(format: String): String
  requestedAtRelativeString: String
  updatedAtRelativeString: String
  expectedAtRelativeString: String
}

type CaseImage {
  tags: [String!]!
  squareThumbnailUrl: String!
  squarePreviewUrl: String!
  originalUrl: String!
}
`;

export type CaseImage = {
  tags: Array<string>,
  squareThumbnailUrl: string,
  squarePreviewUrl: string,
  originalUrl: string,
};

type DateStringArguments = {
  format?: string,
};

function makeHttpsImageUrl(mediaUrl: string): string {
  return (mediaUrl || '')
    .trim()
    .replace(
      'http://boston.spot.show/',
      'https://res.cloudinary.com/spot-boston/'
    )
    .replace(
      'http://spot-boston-res.cloudinary.com/',
      'https://spot-boston-res.cloudinary.com/'
    );
}

function makeResizedImageUrls(url: string) {
  url = makeHttpsImageUrl(url);
  const imagePathMatch = url.match(/^(https?:\/\/.*\/image\/upload)\/(.*)$/);

  if (!imagePathMatch) {
    return {
      originalUrl: url,
      squarePreviewUrl: url,
      squareThumbnailUrl: url,
    };
  } else {
    return {
      originalUrl: url,
      squarePreviewUrl: [
        imagePathMatch[1],
        't_large_square_preview',
        imagePathMatch[2],
      ].join('/'),
      squareThumbnailUrl: [
        imagePathMatch[1],
        't_square_thumbnail',
        imagePathMatch[2],
      ].join('/'),
    };
  }
}

function imagesFromMediaUrl(mediaUrl): Array<CaseImage> {
  if (!mediaUrl) {
    return [];
  } else if (Array.isArray(mediaUrl)) {
    return mediaUrl.map(i => ({
      tags: i.tags || [],
      ...makeResizedImageUrls(i.url),
    }));
  } else {
    return [
      {
        tags: [],
        ...makeResizedImageUrls(mediaUrl),
      },
    ];
  }
}
export const resolvers = {
  Case: {
    id: (r: Root) => r.service_request_id,
    service: (r: Root): ServiceStub => ({
      service_name: r.service_name || '',
      service_code: r.service_code || 'UNKNOWN',
    }),
    description: (r: Root) => r.description || '',
    status: (r: Root) => r.status,
    statusNotes: (r: Root) => r.status_notes || null,
    serviceNotice: (r: Root) => r.service_notice || null,
    closureReason: (r: Root) =>
      (r.closure_details && r.closure_details.reason) || null,
    closureComment: (r: Root) =>
      (r.closure_details && r.closure_details.comment) || null,
    address: (r: Root) => r.address,
    images: (r: Root): Array<CaseImage> => {
      const caseImages = imagesFromMediaUrl(r.media_url);

      // "any" coercion because Flow isn't happy with finding "actitivies" from
      // the Root type union.
      const activitiesImages = ((r: any).activities || [])
        .map((a: ServiceRequestActivity) => imagesFromMediaUrl(a.media_url));

      // Since the activities is an array of arrays, we use reduce to flatten
      // down to a single list of images.
      return [caseImages, ...activitiesImages].reduce(
        (arr, images) => [...arr, ...images],
        []
      );
    },
    location: (r: Root) => {
      if (
        r.reported_location &&
        r.reported_location.lat &&
        r.reported_location.long
      ) {
        // This is the lat/lng from the original submitter. It's preferred over
        // any other because it matches the submitter's intent.
        return { lat: r.reported_location.lat, lng: r.reported_location.long };
      } else if (r.lat != null && r.long != null) {
        // Sometimes a lat/lng wasn't reported (e.g. just an address) so we use
        // the geocoded version from Salesforce.
        return { lat: r.lat, lng: r.long };
      } else if (r.location) {
        // This is the version from the search index. Will follow the above
        // logic on the 311-indexer side.
        return { lat: r.location.lat, lng: r.location.lon };
      } else {
        return null;
      }
    },
    requestedAt: (r: Root) =>
      r.requested_datetime ? moment(r.requested_datetime).unix() : null,
    updatedAt: (r: Root) => {
      const d = r.updated_datetime || r.requested_datetime;
      return d ? moment(d).unix() : null;
    },
    expectedAt: (r: Root) =>
      r.expected_datetime ? moment(r.expected_datetime).unix() : null,

    // We format timezones on the server to avoid having to ship moment to the client
    requestedAtString: (r: Root, { format = '' }: DateStringArguments) =>
      r.requested_datetime
        ? moment(r.requested_datetime).tz('America/New_York').format(format)
        : null,
    updatedAtString: (r: Root, { format = '' }: DateStringArguments) => {
      const d = r.updated_datetime || r.requested_datetime;
      return d ? moment(d).tz('America/New_York').format(format) : null;
    },
    expectedAtString: (r: Root, { format = '' }: DateStringArguments) =>
      r.expected_datetime
        ? moment(r.expected_datetime).tz('America/New_York').format(format)
        : null,

    requestedAtRelativeString: (r: Root) =>
      r.requested_datetime ? moment(r.requested_datetime).fromNow() : null,
    updatedAtRelativeString: (r: Root) => {
      const d = r.updated_datetime || r.requested_datetime;
      return d ? moment(d).fromNow() : null;
    },
    expectedAtRelativeString: (r: Root) =>
      r.expected_datetime ? moment(r.expected_datetime).fromNow() : null,
  },
};
