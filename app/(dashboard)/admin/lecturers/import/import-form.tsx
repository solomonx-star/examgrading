"use client";

import { CsvImportForm } from "@/components/import/CsvImportForm";
import { bulkImportLecturersAction } from "../actions";

const SAMPLE_CSV = `name,email,staffId
Dr. Alusine Bah,alusine.bah@iamco.edu.sl,IAMCO-LEC-1001
Ms. Yeabu Kamara,yeabu.k@iamco.edu.sl,
Mr. Patrick Sankoh,patrick.s@iamco.edu.sl,IAMCO-LEC-1003
`;

export function ImportForm() {
  return (
    <CsvImportForm
      action={bulkImportLecturersAction}
      sampleCsv={SAMPLE_CSV}
      templateFilename="lecturers-template.csv"
      cancelHref="/admin/lecturers"
      backHref="/admin/lecturers"
      backLabel="Back to lecturers"
      formatExplainer={
        <>
          One row per lecturer. Required columns: <code>name</code>,{" "}
          <code>email</code>. Optional: <code>staffId</code>. Each new lecturer
          gets the default password <code>iamco1234</code> and is forced to
          change it on first login. Maximum 500 rows per file.
        </>
      }
    />
  );
}
