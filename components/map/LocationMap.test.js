// @flow

import React from 'react';
import renderer from 'react-test-renderer';
import { mount } from 'enzyme';
import { runInAction } from 'mobx';

import { AppStore } from '../../data/store';

import type LocationMapClass from './LocationMap';

let LocationMap: Class<LocationMapClass>;

let previousBrowserValue;

beforeAll(() => {
  previousBrowserValue = process.browser;
  process.browser = true;

  // We need these shenanigans to get LocationMap loaded with process.browser
  // true, so that it requires leaflet, which can't be required server-side.
  LocationMap = require.requireActual('./LocationMap').default;
});

afterAll(() => {
  process.browser = previousBrowserValue;
});

test('rendering active', () => {
  const store = new AppStore();

  const component = renderer.create(
    <LocationMap
      L={require('mapbox.js')}
      mapboxgl={null}
      store={store}
      mode="picker"
      mobile={false}
    />,
    { createNodeMock: () => document.createElement('div') }
  );
  expect(component.toJSON()).toMatchSnapshot();
});

describe('mounted map', () => {
  let store;
  let wrapper;
  let locationMap: LocationMap;

  beforeEach(() => {
    store = new AppStore();

    wrapper = mount(
      <LocationMap
        L={require('mapbox.js')}
        mapboxgl={null}
        store={store}
        mode="picker"
        mobile={false}
      />
    );

    locationMap = wrapper.instance();
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('positions a marker based on the form location', () => {
    runInAction(() => {
      store.addressSearch.setPlaces(
        [
          {
            address: '1 City Hall Plaza',
            addressId: '12345',
            units: [],
            exact: true,
            alwaysUseLatLng: false,
            location: {
              lat: 42,
              lng: -71,
            },
          },
          {
            address: '2 City Hall Plaza',
            addressId: '12346',
            exact: true,
            alwaysUseLatLng: false,
            units: [],
            location: {
              lat: 43,
              lng: -70,
            },
          },
        ],
        'search',
        false
      );
    });

    const { locationSearchMarkers } = locationMap;
    const locationSearchMarker = locationSearchMarkers[0];

    if (!locationSearchMarker) {
      expect(locationSearchMarker).toBeDefined();
      return;
    }

    const markerLatLng = locationSearchMarker.getLatLng();
    expect(markerLatLng.lat).toEqual(42);
    expect(markerLatLng.lng).toEqual(-71);
  });
});
