import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/exportCsv";
import { downloadPdf } from "@/lib/exportPdf";

function baseName(filename) {
  return String(filename || "export").replace(/\.(csv|pdf)$/i, "");
}

function normalizeDatasets({ exports, filename, rows, columns, title }) {
  if (exports?.length) return exports;
  return [
    {
      filename,
      rows,
      columns,
      title: title || baseName(filename),
      label: title || baseName(filename),
    },
  ];
}

function runExport(format, { filename, rows, columns, title }) {
  if (!rows?.length) {
    toast.error("No data to export");
    return;
  }

  const name = baseName(filename);
  const ok =
    format === "csv"
      ? downloadCsv(`${name}.csv`, rows, columns)
      : downloadPdf(`${name}.pdf`, title || name, rows, columns);

  if (ok) {
    toast.success(format === "csv" ? "CSV downloaded" : "PDF ready — use Save as PDF in the print dialog");
  } else {
    toast.error("Export failed");
  }
}

function ExportDropdown({ label, children, testId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary py-2 text-sm"
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid={testId}
      >
        <Download className="h-4 w-4" />
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1A1A1A] hover:bg-gray-50"
    >
      <Icon className="h-4 w-4 text-[#4A4A4A]" />
      {label}
    </button>
  );
}

function MenuLabel({ children }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8BA888]">
      {children}
    </div>
  );
}

function MenuSeparator() {
  return <div className="my-1 border-t border-gray-100" />;
}

/**
 * Export dropdown — pass `exports` for multiple datasets, or `filename/rows/columns` for one.
 */
export function ExportMenu({
  exports,
  filename,
  rows,
  columns,
  title,
  label = "Export",
  testId = "export-menu",
}) {
  const datasets = normalizeDatasets({ exports, filename, rows, columns, title });
  const multi = datasets.length > 1;

  return (
    <ExportDropdown label={label} testId={testId}>
      {(close) =>
        datasets.map((item, i) => {
          const itemTitle = item.title || baseName(item.filename);
          const itemLabel = item.label || itemTitle;

          if (!multi) {
            return (
              <div key={itemLabel}>
                <MenuItem
                  icon={FileSpreadsheet}
                  label="Download CSV"
                  onClick={() => {
                    runExport("csv", { ...item, title: itemTitle });
                    close();
                  }}
                />
                <MenuItem
                  icon={FileText}
                  label="Download PDF"
                  onClick={() => {
                    runExport("pdf", { ...item, title: itemTitle });
                    close();
                  }}
                />
              </div>
            );
          }

          return (
            <div key={itemLabel}>
              {i > 0 && <MenuSeparator />}
              <MenuLabel>{itemLabel}</MenuLabel>
              <MenuItem
                icon={FileSpreadsheet}
                label="CSV"
                onClick={() => {
                  runExport("csv", { ...item, title: itemTitle });
                  close();
                }}
              />
              <MenuItem
                icon={FileText}
                label="PDF"
                onClick={() => {
                  runExport("pdf", { ...item, title: itemTitle });
                  close();
                }}
              />
            </div>
          );
        })
      }
    </ExportDropdown>
  );
}
