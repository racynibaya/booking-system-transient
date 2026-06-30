// Accessible fallback for every chart: the same numbers as a plain table, tucked behind a
// "Show data" disclosure. Screen readers and anyone who prefers figures get the exact series.
export function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-caption-sm text-muted hover:text-ink">
        Show data
      </summary>
      <table className="mt-2 w-full text-left text-caption-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="py-1 pr-4 font-medium text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-hairline-soft">
              {r.map((c, j) => (
                <td key={j} className="py-1 pr-4 text-body">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
