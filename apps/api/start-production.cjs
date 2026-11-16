// Keep simulation disabled even when the surrounding shell does not set NODE_ENV.
process.env.NODE_ENV = 'production';
require('./dist/main.js');
