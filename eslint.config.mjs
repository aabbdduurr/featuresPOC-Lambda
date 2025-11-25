import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    languageOptions: { 
      globals: {
        ...globals.node,
        ...globals.es2022
      },
      ecmaVersion: 2022,
      sourceType: "module"
    }
  },
  pluginJs.configs.recommended,
  {
    rules: {
      // Code quality rules
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-console": "warn",
      "prefer-const": "error",
      "no-var": "error",
      
      // Style rules
      "indent": ["error", 2],
      "quotes": ["error", "double"],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      
      // Best practices
      "eqeqeq": "error",
      "curly": "error",
      "no-throw-literal": "error",
      "prefer-arrow-callback": "error",
      
      // Modern JS practices  
      "prefer-template": "error",
      "object-shorthand": "error",
      "prefer-destructuring": ["error", {"object": true, "array": false}]
    }
  },
  {
    files: ["src/**/*.mjs"],
    rules: {
      "no-console": "off" // Allow console in Lambda functions for CloudWatch logging
    }
  }
];