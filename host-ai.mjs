export const SCHEMA = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"ponpoko.host.ai.v1","contract_version":1,"title":"Ponpoko Host AI API","description":"Provider-neutral inference through registered surface identity. Validation and setup inspection never call a model.","$defs":{"ModelIo":{"type":"object","properties":{"inputs":{"type":"array","minItems":1,"maxItems":16,"uniqueItems":true,"items":{"type":"string","minLength":1,"maxLength":32,"pattern":"^[a-z0-9_-]+$"}},"outputs":{"type":"array","minItems":1,"maxItems":16,"uniqueItems":true,"items":{"type":"string","minLength":1,"maxLength":32,"pattern":"^[a-z0-9_-]+$"}}},"required":["inputs","outputs"],"additionalProperties":false},"InputPart":{"type":"object","properties":{"type":{"type":"string","minLength":1,"maxLength":32,"pattern":"^[a-z0-9_-]+$"},"text":{"type":["string","null"]},"role":{"enum":["user","assistant","system",null]},"url":{"type":["string","null"]},"data_base64":{"type":["string","null"]},"mime_type":{"type":["string","null"]},"name":{"type":["string","null"]},"value":{}},"required":["type"],"additionalProperties":false,"anyOf":[{"required":["text"],"properties":{"text":{"type":"string"}}},{"required":["url"],"properties":{"url":{"type":"string"}}},{"required":["data_base64"],"properties":{"data_base64":{"type":"string"}}},{"required":["value"],"properties":{"value":{"not":{"type":"null"}}}}],"allOf":[{"if":{"properties":{"type":{"const":"text"}}},"then":{"required":["text"],"properties":{"text":{"type":"string"}}}}]},"InferenceOptions":{"type":"object","properties":{"temperature":{"type":"number"},"max_tokens":{"type":"number"},"count":{"type":"number"},"dimensions":{"type":"number"},"top_n":{"type":"number"},"seed":{"type":"number"},"speed":{"type":"number"},"duration":{"type":"number"},"voice":{"type":"string"},"format":{"type":"string"},"size":{"type":"string"},"query":{"type":"string"},"language":{"type":"string"},"aspect_ratio":{"type":"string"},"tools":{"type":"array","items":{"type":"object"}}},"required":[],"additionalProperties":false},"InferenceRequest":{"type":"object","properties":{"request_id":{"type":"string","minLength":1,"maxBytes":128},"io":{"$ref":"#/$defs/ModelIo"},"input":{"type":"array","minItems":1,"maxItems":256,"items":{"$ref":"#/$defs/InputPart"}},"options":{"$ref":"#/$defs/InferenceOptions"},"stream":{"type":"boolean"},"budget":{"type":"object","properties":{"seconds":{"type":"integer","minimum":1,"maximum":600},"output_bytes":{"type":"integer","minimum":1,"maximum":33554432}},"required":["seconds","output_bytes"],"additionalProperties":false}},"required":["request_id","io","input","budget"],"additionalProperties":false},"AiEnvelope":{"type":"object","properties":{"operation":{"enum":["contract","validate","invoke","invoke_lookup","invoke_status","invoke_events","invoke_stop","invoke_job_status","invoke_job_cancel","slots","usage"]},"contract_version":{"const":1},"input":{"$ref":"#/$defs/InferenceRequest"},"request_id":{"type":"string","minLength":1,"maxBytes":128},"after":{"type":"integer","minimum":0,"maximum":9007199254740991},"check_setup":{"type":"boolean"}},"required":["operation","contract_version"],"additionalProperties":false,"allOf":[{"if":{"properties":{"operation":{"enum":["invoke","validate"]}}},"then":{"required":["input"]}},{"if":{"properties":{"operation":{"enum":["invoke_lookup","invoke_status","invoke_events","invoke_stop","invoke_job_status","invoke_job_cancel"]}}},"then":{"required":["request_id"]}}]},"OutputPart":{"type":"object","properties":{"type":{"type":"string"},"text":{"type":["string","null"]},"url":{"type":["string","null"]},"data_base64":{"type":["string","null"]},"mime_type":{"type":["string","null"]},"value":{},"index":{"type":["integer","null"]}},"required":["type"],"additionalProperties":true},"InferenceResult":{"type":"object","properties":{"output":{"type":"array","items":{"$ref":"#/$defs/OutputPart"}},"usage":{},"job":{"type":"object","properties":{"id":{"type":"string"},"status":{"type":"string"},"progress":{},"error":{}},"required":["id","status"],"additionalProperties":false}},"required":["output"],"additionalProperties":false}},"$ref":"#/$defs/AiEnvelope","examples":[{"operation":"invoke","contract_version":1,"input":{"request_id":"example-lantern","io":{"inputs":["text"],"outputs":["image"]},"input":[{"type":"text","text":"A paper lantern"}],"budget":{"seconds":120,"output_bytes":1048576}}}]};
export const CONTRACT = {"version":1,"schema_sha256":"d7f73a2bf923779ce0612ba2ed918503843a31fc96a8bdd2b2725f9bcda758cd"};
export function validateSchema(root, schema, value, path = "$") {
  const fail = message => { throw Object.assign(new Error(`${path}: ${message}`), { code: "invalid_input", path }); };
  if (schema.$ref) return validateSchema(root, root.$defs[schema.$ref.split("/").at(-1)], value, path);
  const matches = candidate => { try { validateSchema(root, candidate, value, path); return true; } catch { return false; } };
  if (schema.anyOf && !schema.anyOf.some(matches)) fail("does not match an allowed shape");
  if (schema.not && matches(schema.not)) fail("has a disallowed value");
  for (const child of schema.allOf || []) validateSchema(root, child, value, path);
  if (schema.if && matches(schema.if) && schema.then) validateSchema(root, schema.then, value, path);
  if ("const" in schema && value !== schema.const) fail(`must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail(`must be one of ${JSON.stringify(schema.enum)}`);
  const kind = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.includes(kind) && !(kind === "number" && types.includes("integer") && Number.isSafeInteger(value))) fail(`must be ${types.join(" or ")}`);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("must be finite");
    if (schema.minimum !== undefined && value < schema.minimum) fail(`must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(`must be at most ${schema.maximum}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && Array.from(value).length < schema.minLength) fail("is too short");
    if (schema.maxLength !== undefined && Array.from(value).length > schema.maxLength) fail("is too long");
    if (schema.maxBytes !== undefined && new TextEncoder().encode(value).length > schema.maxBytes) fail("exceeds its byte bound");
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail("has an invalid format");
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail("has too few items");
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail("has too many items");
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) fail("must have unique items");
    if (schema.items) value.forEach((item, index) => validateSchema(root, schema.items, item, `${path}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(`missing ${key}`);
    for (const key of Object.keys(value)) {
      if (Object.hasOwn(schema.properties || {}, key)) validateSchema(root, schema.properties[key], value[key], `${path}.${key}`);
      else if (schema.additionalProperties === false) fail(`unexpected field ${key}`);
    }
  }
  return value;
}
export function createHostAi(transport) {
  async function request(operation, payload = {}) {
    const envelope = { ...payload, operation, contract_version: CONTRACT.version };
    validateSchema(SCHEMA, SCHEMA, envelope);
    if (envelope.input?.input.some(part => part.type === "text" && typeof part.text !== "string")) throw Object.assign(new Error("Text input requires text."), { code: "invalid_input" });
    let answer;
    try { answer = await transport(envelope); }
    catch (error) { if (error && typeof error === "object") { error.request_id ??= envelope.input?.request_id ?? envelope.request_id; } throw error; }
    if (answer?.ok === false) throw Object.assign(new Error(answer.error?.message || "Host AI request failed."), answer.error, { request_id: envelope.input?.request_id ?? envelope.request_id });
    return answer?.ok === true ? answer.result : answer;
  }
  return Object.freeze({
    contractVersion: CONTRACT.version,
    contract: () => request("contract"),
    invoke: input => request("invoke", { input }),
    validate: (input, checkSetup = false) => request("validate", { input, check_setup: checkSetup }),
    lookup: request_id => request("invoke_lookup", { request_id }),
    status: request_id => request("invoke_status", { request_id }),
    events: (request_id, after = 0) => request("invoke_events", { request_id, after }),
    stop: request_id => request("invoke_stop", { request_id }),
    jobStatus: request_id => request("invoke_job_status", { request_id }),
    jobCancel: request_id => request("invoke_job_cancel", { request_id }),
    slots: () => request("slots"),
    usage: () => request("usage"),
  });
}
