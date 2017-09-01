// @flow
/* eslint react/no-danger: 0 */

import React from 'react';
import { css } from 'glamor';

import type { Request } from '../../data/types';
import type { AppStore } from '../../data/store';

import SectionHeader from '../common/SectionHeader';
import waypoints, { WAYPOINT_STYLE } from '../map/WaypointMarkers';
import { MEDIA_LARGE, CHARLES_BLUE } from '../style-constants';

export type DefaultProps = {|
  submitted: boolean,
  noMap: boolean,
|};

export type Props = {|
  request: Request,
  store: AppStore,
  submitted?: boolean,
  noMap?: boolean,
|};

const IMG_STYLE = css({
  display: 'block',
  width: '100%',
  [MEDIA_LARGE]: {
    minHeight: 220,
  },
});

const IMG_WRAPPER_STYLE = css({
  display: 'block',
  position: 'relative',
});

const IMG_LABEL_STYLE = css({
  position: 'absolute',
  color: CHARLES_BLUE,
  width: '100%',
  bottom: 0,
  background: 'rgba(255, 255, 255, .8)',
  fontWeight: 'bold',
});

const MAP_WRAPPER_STYLE = css({
  position: 'relative',
});

function renderSubmitted({ id, updatedAtString }: Request, submitted: boolean) {
  if (!submitted) {
    return null;
  }

  return (
    <div className="b b--g p-a500 m-v500">
      <div className="txt-l" style={{ marginTop: 0 }}>
        Request submitted successfully — {updatedAtString}
      </div>
      <div className="t--intro" style={{ fontStyle: 'normal' }}>
        Thank you for submitting. Your case reference number is #{id}. If you
        gave your email address, we’ll send you an email when it’s resolved. You
        can also bookmark this page to check back on it.
      </div>
    </div>
  );
}

function renderStatus({ status, statusNotes, updatedAtString }: Request) {
  if (status !== 'closed') {
    return null;
  }

  return (
    <div className="b b--g p-a500 m-v500">
      <div className="txt-l" style={{ marginTop: 0 }}>
        Resolution — {updatedAtString}
      </div>
      <div className="t--intro" style={{ fontStyle: 'normal' }}>
        {statusNotes || 'Case closed.'}
      </div>
    </div>
  );
}

function makeMapboxUrl(
  store: AppStore,
  request: Request,
  width: number,
  height: number
): string {
  const { apiKeys: { mapbox } } = store;
  const { location } = request;

  if (!location) {
    return '';
  }

  return `https://api.mapbox.com/styles/v1/${mapbox.stylePath}/static/${location.lng},${location.lat},15/${width}x${height}@2x?attribution=false&logo=false&access_token=${encodeURIComponent(
    mapbox.accessToken
  )}`;
}

export default function CaseView({ request, store, submitted, noMap }: Props) {
  const waypointIcon =
    request.status === 'open' ? waypoints.greenFilled : waypoints.orangeFilled;

  const longMap = request.images.length >= 2;

  return (
    <div>
      <div>
        <SectionHeader
          subtitle={
            <span
              style={{
                whiteSpace: 'nowrap',
              }}
            >{`Case ref: #${request.id}`}</span>
          }
        >
          {request.service.name}
        </SectionHeader>

        <div className="m-v300 t--info">
          Submitted on {request.requestedAtString}{' '}
          {request.address && ` — ${request.address}`}
        </div>
      </div>

      {renderSubmitted(request, submitted || false)}

      {renderStatus(request)}

      {request.description &&
        <div className="m-v500">
          <div className="txt-l">Description</div>
          <div className="t--intro" style={{ fontStyle: 'normal' }}>
            {request.description}
          </div>
        </div>}

      {request.location &&
        !noMap &&
        longMap &&
        <div className={MAP_WRAPPER_STYLE}>
          <img
            className={`br br-a150`}
            src={makeMapboxUrl(store, request, 1000, 220)}
            alt={`Map of ${request.address || ''}`}
          />
          <div
            className={`${WAYPOINT_STYLE.toString()}`}
            dangerouslySetInnerHTML={{ __html: waypointIcon.html }}
          />
        </div>}

      <div className="g m-v400">
        {request.location &&
          !noMap &&
          !longMap &&
          <div className="g--6">
            <div className={MAP_WRAPPER_STYLE}>
              <img
                className={`${IMG_STYLE.toString()} m-b500 br br-a150`}
                src={makeMapboxUrl(store, request, 440, 440)}
                alt={`Map of ${request.address || ''}`}
              />
              <div
                className={`${WAYPOINT_STYLE.toString()}`}
                dangerouslySetInnerHTML={{ __html: waypointIcon.html }}
              />
            </div>
          </div>}

        {request.images.length > 0 &&
          request.images.map(img =>
            <div
              className={request.images.length < 3 ? 'g--6' : 'g--4'}
              key={img.originalUrl}
            >
              <a
                href={img.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${IMG_WRAPPER_STYLE.toString()} br br-a150 m-b500`}
              >
                <img
                  className={`${IMG_STYLE.toString()}`}
                  alt={
                    img.tags.join(', ') ||
                    'Photo describing request or resolution'
                  }
                  src={img.squarePreviewUrl}
                />

                {img.tags.length > 0 &&
                  <div
                    className={`${IMG_LABEL_STYLE.toString()} p-a300 t--subtitle tt-u`}
                  >
                    {img.tags.join(', ')}
                  </div>}
              </a>
            </div>
          )}
      </div>
    </div>
  );
}

CaseView.defaultProps = {
  submitted: false,
  noMap: false,
};
