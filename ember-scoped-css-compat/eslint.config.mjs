import { configs } from "@nullvoxpopuli/eslint-configs";

export default [
  ...configs.ember(import.meta.dirname),
  {
    files: ["**/*"],
    rules: {
      "prefer-const": "off",
    },
  },
];
