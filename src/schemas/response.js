const yup = require("yup");

const schema = {
  statusCode: yup.number().required(),
  status: yup.string().required(),
  headers: yup.object(),
  isBase64Encoded: yup.boolean(),
  body: yup.object()
};

module.exports = schema;
