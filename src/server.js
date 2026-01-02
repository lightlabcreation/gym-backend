// const app = require('./app');
// const { port } = require('./config/env');

// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });


import app from "./app.js";
import { ENV } from "./config/env.js";
import "./modules/alert/alert.corn.js";
import "./modules/notifications/notif.corn.js";


app.listen(ENV.port, () => {
  console.log(`Server running on http://localhost:${ENV.port}`);
});
