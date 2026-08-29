<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

$user      = currentUser();
$date      = $_GET['date'] ?? date('Y-m-d');
$search    = trim($_GET['search'] ?? '');
$ekspedisi = strtoupper(trim($_GET['ekspedisi'] ?? ''));
$jenis     = trim($_GET['jenis'] ?? '');
$format    = $_GET['format'] ?? 'csv';

// Build WHERE
$where  = ['1=1'];
$params = [];

if ($date)      { $where[] = 'scan_date = :date';          $params[':date']      = $date; }
if ($search)    { $where[] = 'no_resi LIKE :search';        $params[':search']    = "%$search%"; }
if ($ekspedisi) { $where[] = 'ekspedisi_kode = :ekspedisi'; $params[':ekspedisi'] = $ekspedisi; }
if ($jenis)     { $where[] = 'jenis = :jenis';              $params[':jenis']     = $jenis; }
if ($user['role'] !== 'admin') { $where[] = 'user_id = :uid'; $params[':uid'] = $user['id']; }

$whereStr = implode(' AND ', $where);

try {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT no_resi, ekspedisi, jenis, username, toko, scan_date, scan_time
        FROM scans
        WHERE $whereStr
        ORDER BY scan_date DESC, scan_time DESC
    ");
    $stmt->execute($params);
    $scans = $stmt->fetchAll();

    // Rekap per ekspedisi (mengikuti filter yang aktif, tanpa batasan user sudah diterapkan di atas)
    $rekap = [];
    foreach ($scans as $s) {
        $key = $s['ekspedisi'] ?: 'Lainnya';
        if (!isset($rekap[$key])) $rekap[$key] = 0;
        $rekap[$key]++;
    }
    arsort($rekap);

    if ($format === 'xlsx') {
        generateXlsx($scans, $rekap, $user, $date, $ekspedisi);
        exit;
    }

    if ($format === 'csv') {
        $filename = "scanchecker_export_" . date('Ymd_His') . ".csv";
        header('Content-Type: text/csv; charset=UTF-8');
        header("Content-Disposition: attachment; filename=\"$filename\"");
        header('Pragma: no-cache');

        $out = fopen('php://output', 'w');
        // Baris directive sep=, memaksa Excel (locale apa pun) memakai koma sebagai pemisah kolom
        fwrite($out, "sep=,\r\n");
        // UTF-8 BOM for Excel
        fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, ['No', 'No Resi', 'Ekspedisi', 'Jenis', 'Operator', 'Toko', 'Tanggal', 'Waktu']);

        $i = 1;
        foreach ($scans as $s) {
            fputcsv($out, [
                $i++,
                $s['no_resi'],
                $s['ekspedisi'],
                ucfirst($s['jenis']),
                $s['username'],
                $s['toko'],
                $s['scan_date'],
                substr($s['scan_time'], 0, 5),
            ]);
        }
        // Baris total (satu kolom)
        fputcsv($out, ['total = ' . count($scans)]);
        fclose($out);

    } else {
        // Print HTML
        header('Content-Type: text/html; charset=UTF-8');
        $filterInfo = [];
        if ($date) $filterInfo[] = "Tanggal: $date";
        if ($ekspedisi) $filterInfo[] = "Ekspedisi: $ekspedisi";
        if ($jenis) $filterInfo[] = "Jenis: " . ucfirst($jenis);
        $filterStr = implode(' | ', $filterInfo) ?: 'Semua Data';
        echo "<!DOCTYPE html><html><head><meta charset='UTF-8'>
        <title>Cetak Data ScanChecker</title>
        <style>
            body{font-family:Arial,sans-serif;font-size:12px;color:#000}
            h2{text-align:center;margin-bottom:4px}
            .sub{text-align:center;color:#555;margin-bottom:16px;font-size:11px}
            table{width:100%;border-collapse:collapse}
            th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
            th{background:#f0f0f0;font-weight:bold}
            tr:nth-child(even){background:#f9f9f9}
            .footer{text-align:center;margin-top:16px;font-size:10px;color:#999}
            @media print{.no-print{display:none}}
        </style></head><body onload='window.print()'>
        <h2>ScanChecker — Data Export</h2>
        <div class='sub'>$filterStr &nbsp;|&nbsp; Total: " . count($scans) . " resi &nbsp;|&nbsp; Dicetak: " . date('d/m/Y H:i') . " oleh {$user['nama']}</div>
        <table><thead><tr><th>#</th><th>No Resi</th><th>Ekspedisi</th><th>Jenis</th><th>Operator</th><th>Tanggal</th><th>Waktu</th></tr></thead><tbody>";
        $i = 1;
        foreach ($scans as $s) {
            $jRow = ucfirst($s['jenis']);
            echo "<tr><td>{$i}</td><td><b>{$s['no_resi']}</b></td><td>{$s['ekspedisi']}</td><td>$jRow</td><td>{$s['username']}</td><td>{$s['scan_date']}</td><td>" . substr($s['scan_time'],0,5) . "</td></tr>";
            $i++;
        }
        echo "<tr style='font-weight:bold;background:#eaf6f6'><td colspan='7'>total = " . count($scans) . "</td></tr>";
        echo "</tbody></table><div class='footer'>ScanChecker v2.0 &mdash; " . date('Y') . "</div></body></html>";
    }

} catch (PDOException $e) {
    die('Database error: ' . $e->getMessage());
}

/**
 * Bangun file Excel (.xlsx) secara murni tanpa library eksternal.
 * Berisi 2 sheet: "Data Scan" dan "Rekap Ekspedisi".
 */
function generateXlsx(array $scans, array $rekap, array $user, string $date, string $ekspedisi): void {
    // ===== Shared strings =====
    $shared = [];   // map nilai -> index
    $ssXml  = '';

    $addShared = function(string $val) use (&$shared): int {
        if (!isset($shared[$val])) {
            $shared[$val] = count($shared);
        }
        return $shared[$val];
    };

    $colLetters = ['A','B','C','D','E','F','G','H','I','J','K','L'];
    $nCols = count($colLetters);

    // === Nama sheet ===== digunakan juga untuk perhitungan dimensi
    $header = ['No', 'No Resi', 'Ekspedisi', 'Jenis', 'Operator', 'Toko', 'Tanggal', 'Waktu'];
    $lastCol = $colLetters[count($header) - 1];

    // ===== Build sheet1 XML (Data Scan) =====
    $totalData = count($scans);
    $totalRow  = 2 + $totalData;               // baris setelah data terakhir
    $sheet1Xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<dimension ref="A1:' . $lastCol . $totalRow . '"/><sheetData>';

    // Baris header
    $sheet1Xml .= '<row r="1">';
    foreach ($header as $ci => $h) {
        $idx = $addShared($h);
        $sheet1Xml .= '<c r="' . $colLetters[$ci] . '1" t="s" s="1"><v>' . $idx . '</v></c>';
    }
    $sheet1Xml .= '</row>';

    // Baris data
    $no = 1;
    $rN = 2;
    foreach ($scans as $s) {
        $vals = [
            [$colLetters[0] . $rN, (string)$no++, true],     // No -> angka
            [$colLetters[1] . $rN, $s['no_resi'], false],
            [$colLetters[2] . $rN, $s['ekspedisi'], false],
            [$colLetters[3] . $rN, ucfirst($s['jenis']), false],
            [$colLetters[4] . $rN, $s['username'], false],
            [$colLetters[5] . $rN, $s['toko'], false],
            [$colLetters[6] . $rN, $s['scan_date'], false],
            [$colLetters[7] . $rN, substr($s['scan_time'], 0, 5), false],
        ];
        $sheet1Xml .= '<row r="' . $rN . '">';
        foreach ($vals as $v) {
            list($ref, $value, $isNum) = $v;
            if ($isNum) {
                $sheet1Xml .= '<c r="' . $ref . '" s="2"><v>' . $value . '</v></c>';
            } else {
                $idx = $addShared($value);
                $sheet1Xml .= '<c r="' . $ref . '" t="s"><v>' . $idx . '</v></c>';
            }
        }
        $sheet1Xml .= '</row>';
        $rN++;
    }

    // Baris TOTAL (satu kolom teks "total = N")
    $idxTotal = $addShared('total = ' . $totalData);
    $sheet1Xml .= '<row r="' . $totalRow . '">';
    $sheet1Xml .= '<c r="A' . $totalRow . '" t="s" s="1"><v>' . $idxTotal . '</v></c>';
    $sheet1Xml .= '</row>';

    $sheet1Xml .= '</sheetData></worksheet>';

    // ===== Build sheet2 (Rekap Ekspedisi) =====
    $sheet2LastRow = 2 + count($rekap) + 1;
    $sheet2Xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<dimension ref="A1:B' . $sheet2LastRow . '"/><sheetData>';

    // Judul
    $sheet2Xml .= '<row r="1"><c r="A1" t="s" s="1"><v>' . $addShared('Rekap Per Ekspedisi') . '</v></c></row>';

    $hdr2 = ['Ekspedisi', 'Jumlah Resi'];
    $sheet2Xml .= '<row r="2">';
    foreach ($hdr2 as $ci => $val) {
        $ref = $colLetters[$ci] . '2';
        $idx = $addShared($val);
        $sheet2Xml .= '<c r="' . $ref . '" t="s" s="1"><v>' . $idx . '</v></c>';
    }
    $sheet2Xml .= '</row>';

    $rN = 3;
    foreach ($rekap as $name => $count) {
        $idxName = $addShared($name);
        $sheet2Xml .= '<row r="' . $rN . '">';
        $sheet2Xml .= '<c r="A' . $rN . '" t="s"><v>' . $idxName . '</v></c>';
        $sheet2Xml .= '<c r="B' . $rN . '" s="2"><v>' . $count . '</v></c>';
        $sheet2Xml .= '</row>';
        $rN++;
    }
    // Total
    $totalRow = $rN;
    $sheet2Xml .= '<row r="' . $totalRow . '">';
    $sheet2Xml .= '<c r="A' . $totalRow . '" t="s" s="1"><v>' . $addShared('TOTAL') . '</v></c>';
    $sheet2Xml .= '<c r="B' . $totalRow . '" s="2"><v>' . count($scans) . '</v></c>';
    $sheet2Xml .= '</row>';

    $sheet2Xml .= '</sheetData></worksheet>';

    // ===== Build sharedStrings.xml =====
    $ss = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' . count($shared) . '" uniqueCount="' . count($shared) . '">';
    foreach ($shared as $text => $idx) {
        $esc = htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $ss .= '<si><t>' . $esc . '</t></si>';
    }
    $ss .= '</sst>';

    // ===== Workbooks & rels =====
    $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        . '<Default Extension="xml" ContentType="application/xml"/>'
        . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        . '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        . '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        . '</Types>';

    $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        . '</Relationships>';

    $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        . '<sheets>'
        . '<sheet name="Data Scan" sheetId="1" r:id="rId1"/>'
        . '<sheet name="Rekap Ekspedisi" sheetId="2" r:id="rId2"/>'
        . '</sheets></workbook>';

    $workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
        . '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        . '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
        . '</Relationships>';

    $styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<fonts count="2">'
        . '<font><sz val="11"/><name val="Calibri"/></font>'
        . '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
        . '</fonts>'
        . '<fills count="3">'
        . '<fill><patternFill patternType="none"/></fill>'
        . '<fill><patternFill patternType="gray125"/></fill>'
        . '<fill><patternFill patternType="solid"><fgColor rgb="FF0E8388"/><bgColor indexed="64"/></patternFill></fill>'
        . '</fills>'
        . '<borders count="2">'
        . '<border><left/><right/><top/><bottom/><diagonal/></border>'
        . '<border><left style="thin"><color rgb="FFB0B0B0"/></left><right style="thin"><color rgb="FFB0B0B0"/></right>'
        . '<top style="thin"><color rgb="FFB0B0B0"/></top><bottom style="thin"><color rgb="FFB0B0B0"/></bottom><diagonal/></border>'
        . '</borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        . '<cellXfs count="3">'
        . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'                       // 0 = normal
        . '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' // 1 = header
        . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>'       // 2 = bordered
        . '</cellXfs>'
        . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        . '</styleSheet>';

    // ===== Zip =====
    $filename = "scanchecker_" . date('Ymd_His') . ".xlsx";
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');

    $zip = new ZipArchive();
    $tmp = tempnam(sys_get_temp_dir(), 'xlsx');
    if ($zip->open($tmp, ZipArchive::OVERWRITE) !== true) {
        die('Tidak dapat membuat file Excel');
    }
    $zip->addFromString('[Content_Types].xml', $contentTypes);
    $zip->addFromString('_rels/.rels', $rels);
    $zip->addFromString('xl/workbook.xml', $workbook);
    $zip->addFromString('xl/_rels/workbook.xml.rels', $workbookRels);
    $zip->addFromString('xl/styles.xml', $styles);
    $zip->addFromString('xl/sharedStrings.xml', $ss);
    $zip->addFromString('xl/worksheets/sheet1.xml', $sheet1Xml);
    $zip->addFromString('xl/worksheets/sheet2.xml', $sheet2Xml);
    $zip->close();

    readfile($tmp);
    unlink($tmp);
    exit;
}
