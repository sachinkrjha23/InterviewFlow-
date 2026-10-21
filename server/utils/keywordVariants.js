// Different ways the same skill is commonly written on a resume.
const ALIAS_GROUPS = [
  ["javascript", "es6", "ecmascript"],
  ["node.js", "nodejs", "node js"],
  ["react", "react.js", "reactjs"],
  ["next.js", "nextjs", "next js"],
  ["express", "express.js", "expressjs"],
  ["vue", "vue.js", "vuejs"],
  ["angular", "angularjs"],
  ["mongodb", "mongo"],
  ["postgresql", "postgres"],
  ["kubernetes", "k8s"],
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp", "google cloud"],
  ["ci/cd", "cicd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"],
  ["rest api", "rest apis", "restful api", "restful apis", "restful"],
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["natural language processing", "nlp"],
  ["object-oriented programming", "object oriented programming", "oop"],
  ["data structures", "dsa"],
  ["html", "html5"],
  ["css", "css3"],
  ["c++", "cpp"],
  ["c#", "csharp"],
  [".net", "dotnet"],
];

export const variantsFor = (term) => {
  const base = String(term).toLowerCase().trim();
  const out = new Set([base]);

  if (!base.startsWith(".")) {
    out.add(base.replace(/[.\-/\s]/g, ""));
  }
  out.add(base.replace(/[.\-/]/g, " ")); 

  // simple plural / singular for plain words
  if (/^[a-z ]+$/.test(base) && base.length > 3) {
    out.add(base.endsWith("s") ? base.slice(0, -1) : `${base}s`);
  }

  for (const group of ALIAS_GROUPS) {
    if (group.some((g) => out.has(g))) group.forEach((g) => out.add(g));
  }

  return [...out].filter(Boolean);
};