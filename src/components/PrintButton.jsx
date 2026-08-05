export default function PrintButton({ onClick, disabled }) {
  return <button className="print-button" disabled={disabled} onClick={onClick}>▣ Print</button>;
}
