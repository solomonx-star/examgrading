import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireStudentScope } from "@/lib/student-scope";
import { AccessPayment } from "@/models/AccessPayment";
import { User } from "@/models/User";
import { PrintButton } from "@/components/ui/PrintButton";

export const dynamic = "force-dynamic";

export default async function AccessReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireStudentScope();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const payment = await AccessPayment.findOne({
    _id: id,
    student: me.userId,
  }).lean();
  if (!payment || payment.status !== "completed") notFound();

  const student = await User.findById(me.userId).select("name studentId email").lean();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3 print:hidden">
        <Link
          href="/student/access"
          className="text-sm font-medium text-body hover:text-foreground"
        >
          ← Back
        </Link>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      <section className="rounded-2xl border border-stroke bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            I AM Community College (I AM CO)
          </h1>
          <p className="text-xs text-body">
            24C Luke Lane, Tengbeh Town, Freetown
          </p>
          <p className="text-xs text-body">
            Tel: +232 79424282 / 77573195 · Email: iamcogmsl@gmail.com
          </p>
          <h2 className="mt-3 text-sm font-semibold uppercase">
            Access Payment Receipt
          </h2>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase text-body">Receipt no.</p>
            <p className="font-semibold text-foreground">
              {payment.receiptNumber}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Date</p>
            <p className="font-semibold text-foreground">
              {payment.paidAt
                ? new Date(payment.paidAt).toLocaleString("en-GB")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Student</p>
            <p className="font-semibold text-foreground">{student?.name}</p>
            <p className="font-mono text-xs text-body">
              {student?.studentId ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Period</p>
            <p className="font-semibold text-foreground">
              {payment.academicYear} · {payment.semester}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-body">Method</p>
            <p className="font-semibold capitalize text-foreground">
              {payment.method.replace("_", " ")} ·{" "}
              <span className="text-xs uppercase">{payment.channel}</span>
            </p>
          </div>
          {payment.reference && (
            <div>
              <p className="text-xs uppercase text-body">Reference</p>
              <p className="font-mono text-xs text-foreground break-all">
                {payment.reference}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-stroke pt-4">
          <p className="text-sm text-body">Amount paid</p>
          <p className="text-2xl font-bold text-foreground">
            NLe {payment.amount.toLocaleString()}
          </p>
        </div>

        {payment.note && (
          <p className="mt-3 text-xs text-body">Note: {payment.note}</p>
        )}

        <p className="mt-6 text-[10px] text-body">
          Generated {new Date().toLocaleString("en-GB")} · IAM CO Exam
          Management
        </p>
      </section>
    </div>
  );
}
