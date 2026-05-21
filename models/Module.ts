// "Module" is the product-facing name for what the Mongoose model still
// calls a Course (collection: "courses"). We re-export the existing model
// under both names so new code can import { Module } without forcing a
// schema/collection rename.
export { Course as Module } from "./Course";
export type { ICourse as IModule, Semester } from "./Course";
