"use client";

import { CsvImportForm } from "@/components/import/CsvImportForm";
import { bulkImportStudentsAction } from "../actions";

const SAMPLE_CSV = `name,email,programme,yearLevel
Aminata Bangura,aminata.student@iamco.edu.sl,BSCCS,1
Mohamed Kamara,"mohamed, k@iamco.edu.sl",BSCCS,2
Fatmata Sesay,fatmata.s@iamco.edu.sl,BBA,1
`;

export function ImportForm() {
  return (
    <CsvImportForm
      action={bulkImportStudentsAction}
      sampleCsv={SAMPLE_CSV}
      templateFilename="students-template.csv"
      cancelHref="/admin/students"
      backHref="/admin/students"
      backLabel="Back to students"
      formatExplainer={
        <>
          One row per student. Required columns: <code>name</code>,{" "}
          <code>email</code>, <code>programme</code> (programme{" "}
          <strong>code</strong>, e.g. <code>BSCCS</code>),{" "}
          <code>yearLevel</code> (1–4). Each new student gets the default
          password <code>iamco1234</code> and is forced to change it on first
          login. Maximum 500 rows per file.
        </>
      }
    />
  );
}
