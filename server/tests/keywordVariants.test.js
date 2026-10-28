import { describe, expect, it } from "vitest";
import { variantsFor } from "../utils/keywordVariants.js";

describe("variantsFor", () => {
  it("adds common spellings of Node.js", () => {
    const v = variantsFor("Node.js");
    expect(v).toContain("node.js");
    expect(v).toContain("nodejs");
    expect(v).toContain("node js");
  });

  it("links REST API spellings together", () => {
    const v = variantsFor("REST APIs");
    expect(v).toContain("rest api");
    expect(v).toContain("restful");
  });

  it("adds the plural of a plain word", () => {
    expect(variantsFor("microservice")).toContain("microservices");
  });

  it("knows .NET is also written dotnet and never matches the bare word net", () => {
    const v = variantsFor(".NET");
    expect(v).toContain("dotnet");
    expect(v).not.toContain("net");
  });
});