const yup = require("yup");

const schema = {
  path: yup.string().required(),
  body: yup.object()
};

module.exports = schema;
