// @flow

import React from 'react';
import { storiesOf } from '@kadira/storybook';
import TranslateDialog from './TranslateDialog';

storiesOf('TranslateDialog', module)
  .add('loading', () => (
    <TranslateDialog
      languages={[
        { code: 'en', region: 'US', quality: 1 },
        { code: 'en', region: undefined, quality: 0.8 },
      ]}
    />
  ));