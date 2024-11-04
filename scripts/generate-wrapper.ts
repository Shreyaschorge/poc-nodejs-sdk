// @ts-nocheck
import fs from "fs";
import path from "path";
import ts from "typescript";
import { StringDecoder } from "string_decoder";

interface ParameterInfo {
  name: string;
  originalType: string;
  acceptAsType?: string;
  isOptional: boolean;
  isCommaSeparated: boolean;
  acceptedType: string;
  apiType: string;
  description: string;
}

const decoder = new StringDecoder("utf8");

function decodeString(str) {
  // First remove escaped backslashes
  const unescaped = str.replace(/\\&/g, "&").replace(/\\/g, "");

  // Then decode HTML entities
  const htmlDecoded = unescaped
    .replace(/&#(\d+);/g, (match, dec) => {
      return String.fromCharCode(dec);
    })
    .replace(/&(#x[0-9A-Fa-f]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex.substr(2), 16));
    })
    .replace(/&(\w+);/g, (match, entity) => {
      const entities = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        "#39": "'",
        nbsp: " ",
      };
      return entities[entity] || match;
    });

  // Then decode any remaining UTF-8 sequences if present
  return decoder.write(Buffer.from(htmlDecoded));
}

function getConversionFunction(
  targetType: string,
  valueExpression: string
): string {
  if (targetType === "string") {
    return `String(${valueExpression})`;
  } else if (targetType === "number" || targetType === "integer") {
    return `Number(${valueExpression})`;
  } else {
    // For other types, you may need to handle them specifically
    return valueExpression;
  }
}

// Helper function to convert kebab-case to PascalCase
function kebabToPascalCase(str: string): string {
  return str
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

// Helper function to get description from a property's JSDoc comment
function getPropertyDescription(prop: ts.PropertySignature): string {
  const jsDocComment = ts.getJSDocCommentsAndTags(prop)[0];
  if (!jsDocComment) return "";

  const commentText = jsDocComment.getText();

  // Extract the first line of the comment which is typically the description
  const match = commentText.match(/\/\*\*\s*\n\s*\*(.*?)(?=\n\s*\*\s*@|$)/s);
  if (match && match[1]) {
    // Remove empty lines and join the lines back together
    const description = match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "*")
      .filter((line) => line.trim() !== "")
      .join(" ");

    return description.trim();
  }
  return "";
}

function convertOAS3TypeToTS(type: string): string {
  switch (type) {
    case "integer":
      return "number";
    case "object":
      return "Record<string, any>";
    default:
      return type;
  }
}

// Add this function to build a type map from type names to their declarations
function buildTypeMap(typeFiles: string[]): Map<string, ts.Declaration> {
  const typeMap = new Map<string, ts.Declaration>();

  for (const file of typeFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const sourceFile = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    sourceFile.forEachChild((node) => {
      if (
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)
      ) {
        typeMap.set(node.name.text, node);
      }
    });
  }

  return typeMap;
}

// Helper function to determine if a property is the request body parameter
function isRequestBodyParameter(prop: ts.PropertySignature): boolean {
  return prop.name.getText().endsWith("_req_body");
}

// handle request body parameters
function createMethodSignature(
  requestInterface: ts.InterfaceDeclaration | undefined,
  typeMap: Map<string, ts.Declaration>,
  usedTypes: Set<string>
): {
  paramSignature: string;
  parameterInfos: ParameterInfo[];
  hasRequestBodyParameter: boolean;
  requestBodyParamName?: string;
} {
  let hasRequestBodyParameter = false;
  let requestBodyParamName: string | undefined;

  if (!requestInterface) {
    return { paramSignature: "", parameterInfos: [], hasRequestBodyParameter };
  }

  const parameterInfos: ParameterInfo[] = [];
  const properties: string[] = [];

  requestInterface.members.filter(ts.isPropertySignature).forEach((prop) => {
    const name = prop.name.getText();

    if (isRequestBodyParameter(prop)) {
      hasRequestBodyParameter = true;
      requestBodyParamName = name;

      const typeName = prop.type?.getText() || "any";
      usedTypes.add(typeName);

      const typeDecl = typeMap.get(typeName);

      if (typeDecl && ts.isInterfaceDeclaration(typeDecl)) {
        typeDecl.members.filter(ts.isPropertySignature).forEach((bodyProp) => {
          const bodyPropName = bodyProp.name.getText();
          const bodyPropType = bodyProp.type?.getText() || "any";
          const bodyIsOptional = !!bodyProp.questionToken;

          if (bodyProp.type) {
            collectTypesFromNode(bodyProp.type, usedTypes);
          }

          const description = getPropertyDescription(bodyProp);

          const parameterInfo: ParameterInfo = {
            name: bodyPropName.replace(/['"]/g, ""),
            originalType: bodyPropType,
            isOptional: bodyIsOptional,
            isCommaSeparated: false,
            acceptedType: bodyPropType,
            description,
          };

          parameterInfos.push(parameterInfo);

          const optionalMarker = bodyIsOptional ? "?" : "";

          properties.push(
            `${bodyPropName.replace(
              /['"]/g,
              ""
            )}${optionalMarker}: ${bodyPropType}`
          );
        });
      } else {
        // Handle case where type declaration is not found
        const parameterInfo: ParameterInfo = {
          name,
          originalType: "any",
          isOptional: !!prop.questionToken,
          isCommaSeparated: false,
          acceptedType: "any",
          description: "",
        };

        parameterInfos.push(parameterInfo);
        const optionalMarker = prop.questionToken ? "?" : "";

        properties.push(`${name}${optionalMarker}`);
      }
    } else {
      // Process property as before
      const originalType = prop.type?.getText() || "any";
      const isOptional = !!prop.questionToken;

      if (prop.type) {
        collectTypesFromNode(prop.type, usedTypes);
      }

      const jsDocTags = ts.getJSDocTags(prop);

      const acceptAsTag = jsDocTags.find(
        (tag) => tag.tagName.getText() === "acceptAs"
      );
      let acceptAsType = acceptAsTag?.comment?.trim();

      acceptAsType = convertOAS3TypeToTS(acceptAsType);

      const isCommaSeparated = jsDocTags.some(
        (tag) => tag.tagName.getText() === "commaSeparated"
      );

      let acceptedType = acceptAsType || originalType;

      if (isCommaSeparated && !acceptedType.endsWith("[]")) {
        acceptedType = `${acceptedType}[]`;
      }

      const description = getPropertyDescription(prop);

      const parameterInfo: ParameterInfo = {
        name,
        originalType,
        acceptAsType,
        isOptional,
        isCommaSeparated,
        acceptedType,
        description,
      };

      parameterInfos.push(parameterInfo);

      const optionalMarker = isOptional ? "?" : "";

      properties.push(`${name}${optionalMarker}: ${acceptedType}`);
    }
  });

  return {
    paramSignature: properties.length > 0 ? `{ ${properties.join(", ")} }` : "",
    parameterInfos,
    hasRequestBodyParameter,
    requestBodyParamName,
  };
}

// Helper function to extract JSDoc comment from a node
function getJSDocComment(
  methodNode: ts.MethodSignature,
  requestInterface: ts.InterfaceDeclaration | undefined,
  methodName: string,
  responseType: string,
  parameterInfos: ParameterInfo[],
  hasRequestBodyParameter: boolean
): string {
  // Extract initial JSDoc
  let jsDoc = methodNode.getFullText().match(/\/\*\*[\s\S]*?\*\//)?.[0] || "";

  // Clean up initial JSDoc and remove unwanted tags
  jsDoc = jsDoc
    .replace(/\s*\* @param \{\*\} \[options\][^\n]*\n/g, "")
    .replace(/\s*\* @throws[^\n]*\n/g, "")
    .replace(/\s*\* @memberof[^\n]*\n/g, "")
    .replace(/\s*\*\//g, "\n */");

  // Extract description and @summary
  const descriptionMatch = jsDoc.match(
    /\/\*\*\s*\n\s*\*(.*?)(?=\s*\n\s*\* @|$)/s
  );
  const summaryMatch = jsDoc.match(/\* @summary (.*?)(?=\n|$)/);

  // Extract documentation URL
  const docUrlMatch = jsDoc.match(/^\s*\*\s*(For more information.*$)/m);
  const docUrl = docUrlMatch?.[1] || "";

  // Start building new JSDoc
  let newJsDoc = "/**\n";

  // Add description
  if (descriptionMatch?.[1]) {
    newJsDoc += ` *${descriptionMatch[1]}\n *\n`;
  }

  // Add @summary
  if (summaryMatch?.[1]) {
    const cleanedSummary = summaryMatch[1].replace(/\s*\*.*$/, "");
    newJsDoc += ` * @summary ${cleanedSummary}\n *\n`;
  }

  // Add parameter documentation
  if (parameterInfos.length > 0) {
    newJsDoc += ` * @param {object} params\n`;

    parameterInfos.forEach((param) => {
      const { name, acceptedType, isOptional, description } = param;
      const optionalText = isOptional ? "[optional] " : "";
      const descriptionText = description
        ? ` - ${decodeString(description)}`
        : "";

      newJsDoc += ` * @param {${acceptedType}} params.${name} ${optionalText}${descriptionText}\n`;
    });
  }

  // Add single @returns tag
  newJsDoc += ` *\n * @returns {Promise<${responseType}>} A promise that resolves to a \`${responseType}\` object.\n`;

  // Add @example section
  if (hasRequestBodyParameter) {
    newJsDoc += ` *\n * @example\n *\n * // Fill in the appropriate values\n`;

    parameterInfos.forEach((param) => {
      const { name } = param;
      newJsDoc += ` * const ${name} = \n`;
    });

    newJsDoc += ` *\n`;
    const params = parameterInfos.map((param) => param.name).join(", ");

    newJsDoc += ` * client.${methodName}({${params}}).then(response => {\n`;
    newJsDoc += ` *   console.log('response:', response);\n`;
    newJsDoc += ` * });\n`;
  } else if (requestInterface) {
    newJsDoc += ` *\n * @example\n *\n * // Fill in the appropriate values\n`;

    // Add variable declarations
    requestInterface.members
      .filter((member): member is ts.PropertySignature =>
        ts.isPropertySignature(member)
      )
      .filter((prop) => prop.name?.getText() !== "cursor")
      .forEach((prop) => {
        const name = prop.name?.getText() ?? "";
        newJsDoc += ` * const ${name} = \n`;
      });

    newJsDoc += ` *\n`;

    // Add client call with params object
    const params = requestInterface.members
      .filter((member): member is ts.PropertySignature =>
        ts.isPropertySignature(member)
      )
      .map((prop) => prop.name?.getText() ?? "")
      .filter((name) => name !== "cursor")
      .join(", ");

    newJsDoc += ` * client.${methodName}({${params}}).then(response => {\n`;
    newJsDoc += ` *   console.log('response:', response);\n`;
    newJsDoc += ` * });\n`;
  } else {
    // Example for methods without params
    newJsDoc += ` *\n * @example\n *\n`;
    newJsDoc += ` * client.${methodName}().then(response => {\n`;
    newJsDoc += ` *   console.log('response:', response);\n`;
    newJsDoc += ` * });\n`;
  }

  // Add documentation URL at the end
  if (docUrl) {
    newJsDoc += ` *\n * ${docUrl}\n *\n`;
  }

  // Close JSDoc
  newJsDoc += " */";

  return newJsDoc;
}

const builtInTypeNames = new Set([
  "string",
  "number",
  "boolean",
  "void",
  "undefined",
  "null",
  "any",
  "unknown",
  "never",
  "object",
  "Function",
  "Symbol",
  "bigint",
  "Array",
  "Promise",
  "Set",
  "Map",
  "Date",
  "RegExp",
  "AxiosPromise",
  "AxiosInstance",
  "RawAxiosRequestConfig",
  "Record",
]);

function isValidIdentifier(typeName: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(typeName);
}

function collectTypesFromNode(node: ts.Node, types: Set<string>) {
  if (ts.isTypeReferenceNode(node)) {
    const typeName = node.typeName.getText();

    if (isValidIdentifier(typeName) && !builtInTypeNames.has(typeName)) {
      types.add(typeName);
    }

    // Process type arguments (e.g., generics like Array<Type>)
    if (node.typeArguments) {
      node.typeArguments.forEach((typeArg) =>
        collectTypesFromNode(typeArg, types)
      );
    }
  } else if (ts.isArrayTypeNode(node)) {
    collectTypesFromNode(node.elementType, types);
  } else if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    node.types.forEach((typeNode) => collectTypesFromNode(typeNode, types));
  } else if (ts.isTypeLiteralNode(node)) {
    // Do not collect types from TypeLiteralNodes (inline object types)
  } else if (ts.isLiteralTypeNode(node)) {
    // Ignore literal types (e.g., string literals)
  } else if (ts.isPropertySignature(node) && node.type) {
    collectTypesFromNode(node.type, types);
  } else if (ts.isMethodSignature(node)) {
    node.parameters.forEach((param) => {
      if (param.type) {
        collectTypesFromNode(param.type, types);
      }
    });
    if (node.type) {
      collectTypesFromNode(node.type, types);
    }
  } else {
    // Recursively process child nodes
    node.forEachChild((child) => collectTypesFromNode(child, types));
  }
}

function findTypeDeclarationFiles(apiDir: string): string[] {
  const typeFiles = new Set<string>();

  function walk(dir: string) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walk(filePath);
      } else if (file.endsWith(".ts") && !file.endsWith(".test.ts")) {
        typeFiles.add(filePath);
      }
    }
  }

  walk(path.dirname(apiDir));
  return Array.from(typeFiles);
}

function findTypeSourceFile(
  typeName: string,
  typeFiles: string[]
): { file: string; relativePath: string } | null {
  for (const file of typeFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const sourceFile = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    let found = false;
    sourceFile.forEachChild((node) => {
      if (
        (ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isEnumDeclaration(node)) &&
        node.name.text === typeName
      ) {
        found = true;
      }
    });

    if (found) {
      const relativePath = path
        .relative(path.dirname(process.cwd()), file)
        .replace(/\\/g, "/")
        .replace(/^src\//, "../");

      return { file, relativePath };
    }
  }

  return null;
}

function generateWrapper(apiDir: string, outputFile: string) {
  const apiFiles = fs
    .readdirSync(apiDir)
    .filter((file) => file.endsWith("-api.ts"));

  if (apiFiles.length === 0) {
    throw new Error(`No API files found in ${apiDir}`);
  }

  console.log("Found API files:", apiFiles);

  // Collect types from API files first
  const typeFiles = findTypeDeclarationFiles(apiDir);
  const typeImports = new Map<string, Set<string>>();

  // Build the type map
  const typeMap = buildTypeMap(typeFiles);

  const usedTypes = new Set<string>();

  let wrapperCode = `
export interface NeynarAPIClientOptions {
  basePath?: string;
  logger?: Logger;
  axiosInstance?: AxiosInstance;
}

export class NeynarAPIClient {
  private readonly apiKey: string;
  private readonly logger: Logger;

  public readonly apis: {
    ${apiFiles
      .map((file) => {
        const apiName = kebabToPascalCase(file.replace(".ts", ""));
        const propertyName = apiName.charAt(0).toLowerCase() + apiName.slice(1);
        return `${propertyName}: ${apiName};`;
      })
      .join("\n    ")}
  };

  constructor(
    apiKey: string,
    options: NeynarAPIClientOptions = {}
  ) {
    const { basePath, logger, axiosInstance: customAxiosInstance } = options;
    
    this.logger = logger || console;
    this.apiKey = apiKey;

    if (apiKey === "") {
      throw new Error(
        "Attempt to use an authenticated API method without first providing an api key"
      );
    }

    const axiosInstance = customAxiosInstance || axios.create({
      headers: {
        "x-sdk-version": process.env.npm_package_version,
      },
    });

    axiosInstance.defaults.decompress = true;
    axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && [302].includes(error.response.status)) {
          return {
            data: {
              location: error.response.headers.location,
            },
          };
        }
        if (NeynarAPIClient.isApiErrorResponse(error)) {
          const apiErrors = error.response.data;
          this.logger.warn(\`API errors: \${JSON.stringify(apiErrors)}\`);
        }
        throw error;
      }
    );

    const config = new Configuration({
      ...(basePath ? { basePath:  \`\${basePath}/v2\` } : {}),
      apiKey: apiKey,
    });

    this.apis = {
      ${apiFiles
        .map((file) => {
          const apiName = kebabToPascalCase(file.replace(".ts", ""));
          const propertyName =
            apiName.charAt(0).toLowerCase() + apiName.slice(1);
          return `${propertyName}: new ${apiName}(config, undefined, axiosInstance),`;
        })
        .join("\n      ")}
    };
  }

  public static isApiErrorResponse(
    error: any
  ): error is SetRequired<AxiosError<ErrorRes>, "response"> {
    if (!(error instanceof AxiosError)) return false;
    return (
      error.response?.data !== undefined && "message" in error.response.data
    );
  }

  ${apiFiles
    .map((file) => {
      const apiContent = fs.readFileSync(path.join(apiDir, file), "utf-8");
      const sourceFile = ts.createSourceFile(
        file,
        apiContent,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );

      const apiName = kebabToPascalCase(file.replace(".ts", ""));
      const apiInstance = apiName.charAt(0).toLowerCase() + apiName.slice(1);

      // Find the API interface
      const apiInterface = sourceFile.statements
        .filter(ts.isInterfaceDeclaration)
        .find((iface) => iface.name.text === `${apiName}Interface`);

      if (!apiInterface) return "";

      // Find all request interfaces
      const requestInterfaces = sourceFile.statements
        .filter(ts.isInterfaceDeclaration)
        .filter((iface) => iface.name.text.endsWith("Request"));

      // Get all methods from the API interface
      return apiInterface.members
        .filter(ts.isMethodSignature)
        .map((method) => {
          const methodName = method.name.getText();

          // Find the corresponding request interface if it exists
          const requestInterface = requestInterfaces.find((iface) =>
            iface.name.text.toLowerCase().includes(methodName.toLowerCase())
          );

          let responseType = "any";
          if (method.type && ts.isTypeReferenceNode(method.type)) {
            responseType = method.type.typeArguments?.[0].getText() || "any";
            // Add response type to used types
            usedTypes.add(responseType);
          }

          const {
            paramSignature,
            parameterInfos,
            hasRequestBodyParameter,
            requestBodyParamName,
          } = createMethodSignature(requestInterface, typeMap, usedTypes);

          // Add types from parameter infos
          parameterInfos.forEach((param) => {
            if (param.originalType && param.originalType !== "any") {
              usedTypes.add(param.originalType);
            }
            if (param.acceptedType && param.acceptedType !== "any") {
              // Handle array types
              const baseType = param.acceptedType.replace("[]", "");
              if (baseType !== param.acceptedType) {
                usedTypes.add(baseType);
              } else {
                usedTypes.add(param.acceptedType);
              }
            }
          });

          const methodParamsParts = [];
          if (paramSignature) {
            methodParamsParts.push(`params: ${paramSignature}`);
          }
          methodParamsParts.push(`options?: RawAxiosRequestConfig`);
          const methodParams = methodParamsParts.join(", ");

          const jsDoc = getJSDocComment(
            method,
            requestInterface,
            methodName,
            responseType,
            parameterInfos,
            hasRequestBodyParameter
          );

          // Generate code to adjust comma-separated params
          let adjustParamsCode = "";
          if (hasRequestBodyParameter) {
            adjustParamsCode += `const _params = { ${requestBodyParamName}: params };\n`;
            adjustParamsCode += `const adjustedParams: any = { ..._params };\n`;
          } else if (paramSignature) {
            adjustParamsCode += `const adjustedParams: any = { ...params };\n`;
          }

          parameterInfos.forEach((param) => {
            const paramName = param.name;

            // If acceptAsType is different from originalType
            if (
              param.acceptAsType &&
              param.acceptAsType !== param.originalType
            ) {
              if (param.acceptedType.endsWith("[]")) {
                adjustParamsCode += `if (adjustedParams.${paramName} && Array.isArray(adjustedParams.${paramName})) {\n`;
                // adjustParamsCode += `// @ts-ignore\n`;
                adjustParamsCode += `  adjustedParams.${paramName} = adjustedParams.${paramName}.map(value => (${getConversionFunction(
                  param.originalType,
                  "value"
                )}));\n`;
                adjustParamsCode += `}\n`;
              } else {
                adjustParamsCode += `if (adjustedParams.${paramName} != null) {\n`;
                adjustParamsCode += `  adjustedParams.${paramName} = ${getConversionFunction(
                  param.originalType,
                  `adjustedParams.${paramName}`
                )};\n`;
                adjustParamsCode += `}\n`;
              }
            }

            // If commaSeparated
            if (param.isCommaSeparated && param.acceptedType.endsWith("[]")) {
              adjustParamsCode += `if (adjustedParams.${paramName} && Array.isArray(adjustedParams.${paramName})) {\n`;
              // adjustParamsCode += `// @ts-ignore\n`;
              adjustParamsCode += `  adjustedParams.${paramName} = adjustedParams.${paramName}.join(",");\n`;
              adjustParamsCode += `}\n`;
            }
          });

          const apiMethodParams = paramSignature
            ? "adjustedParams, options"
            : "options";

          return `
${jsDoc}
public async ${methodName}(${methodParams}): Promise<${responseType}> {
  ${adjustParamsCode}
  const response = await this.apis.${apiInstance}.${methodName}(${apiMethodParams});
  return response.data;
}`;
        })
        .join("\n");
    })
    .join("\n")}
}
`;

  // Find source files for collected types
  for (const type of usedTypes) {
    const typeSource = findTypeSourceFile(type, typeFiles);
    if (typeSource) {
      const importPath = typeSource.relativePath.replace(/\.ts$/, "");
      if (!typeImports.has(importPath)) {
        typeImports.set(importPath, new Set());
      }
      typeImports.get(importPath)?.add(type);
    }
  }

  const filteredTypes = Array.from(usedTypes).filter(
    (typeName) => isValidIdentifier(typeName) && !builtInTypeNames.has(typeName)
  );

  filteredTypes.push("ErrorRes");

  // Generate import statements
  const importStatements =
    filteredTypes.length > 0
      ? `import type { ${filteredTypes.sort().join(", ")} } from '../api';`
      : "";

  // Combine everything
  const finalCode = `
import { Logger } from "../common/logger";
import axios, { AxiosError, AxiosInstance, RawAxiosRequestConfig } from "axios";
import type { SetRequired } from "type-fest";
import { Configuration } from '../api/configuration';
${apiFiles
  .map((file) => {
    const apiName = kebabToPascalCase(file.replace(".ts", ""));
    return `import { ${apiName} } from '../api/apis/${file.replace(
      ".ts",
      ""
    )}';`;
  })
  .join("\n")}
${importStatements}

${wrapperCode}`;

  const generatedDir = path.dirname(outputFile);
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, finalCode);
  console.log(`Generated wrapper class at ${outputFile}`);
}

// Run the generator
const apiDir = path.join(process.cwd(), "src", "api", "apis");
const outputFile = path.join(
  process.cwd(),
  "src",
  "generated",
  "NeynarAPIClient.ts"
);
generateWrapper(apiDir, outputFile);
