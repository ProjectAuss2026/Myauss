import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://o4511562008952832.ingest.us.sentry.io/4511562016620544',
  // To disable sending user data, uncomment the line below. For more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
  // dataCollection: { userInfo: false },
});
