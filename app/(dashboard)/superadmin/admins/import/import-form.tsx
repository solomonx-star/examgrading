"use client";

import { CsvImportForm } from "@/components/import/CsvImportForm";
import { bulkImportAdminsAction } from "../actions";

const SAMPLE_CSV = `name,email,staffId
Alusine Bah,alusine.admin@iamco.edu.sl,IAMCO-ADM-1001
Yeabu Kamara,yeabu.admin@iamco.edu.sl,
Patrick Sankoh,patrick.admin@iamco.edu.sl,IAMCO-ADM-1003
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
          <code>email</code>. Optional: <code>staffId</code>. Each new admin
          gets the default password <code>iamco1234</code> and is forced to
          change it on first login. Maximum 500 rows per file.
        </>
      }
    />
  );
}
