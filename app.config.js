import 'dotenv/config';

export default ({ config }) => ({
    ...config,
    extra: {
        waqiToken: process.env.WAQI_TOKEN,
    },
});
