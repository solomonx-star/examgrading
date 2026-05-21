"use client";

import { CsvImportForm } from "@/components/import/CsvImportForm";
import { bulkImportAdminsAction } from "../actions";

const SAMPLE_CSV = `name,email,department,staffId
Alusine Bah,alusine.admin@iamco.edu.sl,Computer Science,IAMCO-ADM-1001
Yeabu Kamara,yeabu.admin@iamco.edu.sl,Business Administration,
Patrick Sankoh,patrick.admin@iamco.edu.sl,General Studies,IAMCO-ADM-1003
`;

export function ImportForm() {
  return (
    <CsvImportForm
      action={bulkImportAdminsAction}
      sampleCsv={SAMPLE_CSV}
      templateFilename="admins-template.csv"
      cancelHref="/superadmin/admins"
      backHref="/superadmin/admins"
      backLabel="Back to admins"
      formatExplainer={
        <>
          One row per admin. Required columns: <code>name</code>,{" "}
          <code>email</code>, <code>department</code>. Optional:{" "}
          <code>staffId</code>. Each row's department determines which
          institution the admin will manage. Each new admin gets the default
          password <code>iamco1234</code> and is forced to change it on first
          login. Maximum 500 rows per file.
        </>
      }
    />
  );
}
