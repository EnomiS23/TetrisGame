<?php
declare(strict_types=1);

session_start();

$servername = "127.0.0.1";
$dbUser = "root";
$dbPass = "simone";
$dbname = "tetris";

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conn = new mysqli($servername, $dbUser, $dbPass, $dbname);
$conn->set_charset("utf8mb4");

header('Content-Type: application/json; charset=utf-8');

function respond(int $code, array $payload): void {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) respond(400, ['ok' => false, 'error' => 'JSON invalid']);
    return $data;
}

function requireUserId(): int {
    if (!isset($_SESSION['userId'])) respond(401, ['ok' => false, 'error' => 'Neautentificat']);
    return (int)$_SESSION['userId'];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? null;
if ($method === 'POST') {
    $body = getJsonBody();
    if (isset($body['action']) && is_string($body['action'])) $action = $body['action'];
} else {
    $body = [];
}

if (!$action) respond(400, ['ok' => false, 'error' => 'Lipsește action']);

try {
    // AUTH: dacă user nu există -> create, altfel login
    if ($action === 'auth' && $method === 'POST') {
        $username = trim((string)($body['username'] ?? ''));
        $password = (string)($body['password'] ?? '');
        if ($username === '' || strlen($username) < 4) respond(422, ['ok' => false, 'error' => 'Username invalid (min 4)']);
        if ($password === '' || strlen($password) < 4) respond(422, ['ok' => false, 'error' => 'Password invalid (min 4)']);

        $stmt = $conn->prepare("SELECT userId, password FROM `user` WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($row = $res->fetch_assoc()) {
            $storedPassword = (string)$row['password'];
            if ($password !== $storedPassword) respond(403, ['ok' => false, 'error' => 'Parolă greșită']);
            $_SESSION['userId'] = (int)$row['userId'];
            respond(200, ['ok' => true, 'mode' => 'login', 'userId' => (int)$row['userId'], 'username' => $username]);
        }

        // Stocare parolă în clar (fără criptare/hash), conform cerinței.
        $stmt2 = $conn->prepare("INSERT INTO `user` (username, password) VALUES (?, ?)");
        $stmt2->bind_param("ss", $username, $password);
        $stmt2->execute();
        $userId = (int)$stmt2->insert_id;
        $_SESSION['userId'] = $userId;
        respond(201, ['ok' => true, 'mode' => 'register', 'userId' => $userId, 'username' => $username]);
    }

    // SAVE GAME
    if ($action === 'save_game' && $method === 'POST') {
        $userId = requireUserId();
        $matriceNume = trim((string)($body['matrice_nume'] ?? ''));
        $scor = (int)($body['scor'] ?? 0);
        $playground = $body['playground'] ?? null; // JSON array/object

        if ($matriceNume === '') respond(422, ['ok' => false, 'error' => 'Lipsește matrice_nume (nume joc)']);
        if (!is_array($playground)) respond(422, ['ok' => false, 'error' => 'playground trebuie să fie JSON (array/object)']);

        $playgroundJson = json_encode($playground, JSON_UNESCAPED_UNICODE);
        if ($playgroundJson === false) respond(400, ['ok' => false, 'error' => 'Nu pot serializa playground']);

        $stmt = $conn->prepare("INSERT INTO matrice (user_id, matrice_nume, playground, scor) VALUES (?, ?, CAST(? AS JSON), ?)");
        $stmt->bind_param("issi", $userId, $matriceNume, $playgroundJson, $scor);
        $stmt->execute();
        $matriceId = (int)$stmt->insert_id;

        $stmt2 = $conn->prepare("INSERT INTO logs (userId, matriceId, scor) VALUES (?, ?, ?)");
        $stmt2->bind_param("iii", $userId, $matriceId, $scor);
        $stmt2->execute();

        respond(200, ['ok' => true, 'matriceId' => $matriceId]);
    }

    // UPDATE EXISTING GAME (autosave fără joc nou)
    if ($action === 'update_game' && $method === 'POST') {
        $userId = requireUserId();
        $matriceId = (int)($body['matriceId'] ?? 0);
        $scor = (int)($body['scor'] ?? 0);
        $playground = $body['playground'] ?? null;

        if ($matriceId <= 0) respond(422, ['ok' => false, 'error' => 'matriceId invalid']);
        if (!is_array($playground)) respond(422, ['ok' => false, 'error' => 'playground trebuie să fie JSON (array)']);

        // Verifică owner (user_id)
        $stmt0 = $conn->prepare("SELECT user_id FROM matrice WHERE idMatrice = ? LIMIT 1");
        $stmt0->bind_param("i", $matriceId);
        $stmt0->execute();
        $res0 = $stmt0->get_result();
        $row0 = $res0->fetch_assoc();
        if (!$row0) respond(404, ['ok' => false, 'error' => 'Joc inexistent']);
        if ((int)$row0['user_id'] !== $userId) respond(403, ['ok' => false, 'error' => 'Nu ai acces la jocul acesta']);

        $playgroundJson = json_encode($playground, JSON_UNESCAPED_UNICODE);
        if ($playgroundJson === false) respond(400, ['ok' => false, 'error' => 'Nu pot serializa playground']);

        $stmt = $conn->prepare("UPDATE matrice SET playground = CAST(? AS JSON), scor = ? WHERE idMatrice = ?");
        $stmt->bind_param("sii", $playgroundJson, $scor, $matriceId);
        $stmt->execute();

        // Logs: vrem să se vadă scorul curent la Continue.
        // Ținem 1 rând per (userId, matriceId): update dacă există, altfel insert.
        $stmt2 = $conn->prepare("UPDATE logs SET scor = ?, `timestamp` = NOW() WHERE userId = ? AND matriceId = ?");
        $stmt2->bind_param("iii", $scor, $userId, $matriceId);
        $stmt2->execute();
        if ($stmt2->affected_rows === 0) {
            $stmt2b = $conn->prepare("INSERT INTO logs (userId, matriceId, scor) VALUES (?, ?, ?)");
            $stmt2b->bind_param("iii", $userId, $matriceId, $scor);
            $stmt2b->execute();
        }

        respond(200, ['ok' => true, 'matriceId' => $matriceId]);
    }

    // LIST LOGS (Continue)
    if ($action === 'list_logs' && $method === 'GET') {
        $userId = requireUserId();
        $stmt = $conn->prepare("
            SELECT 
              l.idlogs,
              l.matriceId,
              l.scor,
              l.timestamp,
              m.matrice_nume
            FROM logs l
            JOIN matrice m ON m.idMatrice = l.matriceId
            WHERE l.userId = ?
            ORDER BY l.timestamp DESC
            LIMIT 50
        ");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $res = $stmt->get_result();
        $rows = [];
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        respond(200, ['ok' => true, 'logs' => $rows]);
    }

    // LOAD GAME (click log)
    if ($action === 'load_game' && $method === 'GET') {
        $userId = requireUserId();
        $matriceId = (int)($_GET['matriceId'] ?? 0);
        if ($matriceId <= 0) respond(422, ['ok' => false, 'error' => 'matriceId invalid']);

        $stmt = $conn->prepare("SELECT idMatrice, user_id, matrice_nume, playground, scor FROM matrice WHERE idMatrice = ? LIMIT 1");
        $stmt->bind_param("i", $matriceId);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        if (!$row) respond(404, ['ok' => false, 'error' => 'Joc inexistent']);
        if ((int)$row['user_id'] !== $userId) respond(403, ['ok' => false, 'error' => 'Nu ai acces la jocul acesta']);

        respond(200, [
            'ok' => true,
            'game' => [
                'matriceId' => (int)$row['idMatrice'],
                'matrice_nume' => $row['matrice_nume'],
                'playground' => json_decode((string)$row['playground'], true),
                'scor' => (int)$row['scor'],
            ],
        ]);
    }

    // LEADERBOARD TOP 10 (din logs + matrice + user)
    if ($action === 'leaderboard_top10' && $method === 'GET') {
        // Cerință: afișăm doar top 10 scoruri din tabela leaderboard.
        // (Nu mai depindem de logs/matrice pentru leaderboard.)
        $stmt = $conn->prepare("
            SELECT 
              u.username,
              lb.scor
            FROM leaderboard lb
            JOIN `user` u ON u.userId = lb.userId
            ORDER BY lb.scor DESC
            LIMIT 10
        ");
        $stmt->execute();
        $res = $stmt->get_result();
        $rows = [];
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        respond(200, ['ok' => true, 'top' => $rows]);
    }

    // GAME OVER: salvează în leaderboard dacă intră în top 10 + șterge din logs
    if ($action === 'submit_game_over' && $method === 'POST') {
        $userId = requireUserId();
        $scor = (int)($body['scor'] ?? 0);
        $matriceId = isset($body['matriceId']) ? (int)$body['matriceId'] : 0;

        // Decide dacă intră în top 10 (sau dacă sunt <10 intrări).
        $stmt0 = $conn->prepare("SELECT COUNT(*) AS c, MIN(scor) AS min_scor FROM leaderboard");
        $stmt0->execute();
        $r0 = $stmt0->get_result()->fetch_assoc();
        $count = (int)($r0['c'] ?? 0);
        $minScor = $r0['min_scor'];
        $minScor = ($minScor === null) ? null : (int)$minScor;

        $inserted = false;
        if ($count < 10 || ($minScor !== null && $scor > $minScor) || ($minScor === null && $count === 0)) {
            $stmt1 = $conn->prepare("INSERT INTO leaderboard (userId, scor) VALUES (?, ?)");
            $stmt1->bind_param("ii", $userId, $scor);
            $stmt1->execute();
            $inserted = true;

            // Optional: ținem tabela compactă la max 10 intrări (ștergem cele mai mici scoruri în plus).
            // Fără coloană de id/timestamp, ștergem “orice” din cele cu scor minim, cât trebuie.
            $stmtTrim = $conn->prepare("SELECT COUNT(*) AS c2, MIN(scor) AS min2 FROM leaderboard");
            $stmtTrim->execute();
            $rTrim = $stmtTrim->get_result()->fetch_assoc();
            $c2 = (int)($rTrim['c2'] ?? 0);
            $min2 = $rTrim['min2'];
            $min2 = ($min2 === null) ? null : (int)$min2;
            if ($c2 > 10 && $min2 !== null) {
                $toDelete = $c2 - 10;
                // Șterge $toDelete rânduri cu scor minim.
                $stmtDel = $conn->prepare("DELETE FROM leaderboard WHERE scor = ? LIMIT " . $toDelete);
                $stmtDel->bind_param("i", $min2);
                $stmtDel->execute();
            }
        }

        // Cerință: dacă jocul e în logs (Continue), îl ștergem din logs după Game Over.
        if ($matriceId > 0) {
            $stmt2 = $conn->prepare("DELETE FROM logs WHERE userId = ? AND matriceId = ?");
            $stmt2->bind_param("ii", $userId, $matriceId);
            $stmt2->execute();
        }

        respond(200, ['ok' => true, 'inserted' => $inserted]);
    }

    respond(404, ['ok' => false, 'error' => 'Action necunoscut sau metodă greșită']);
} catch (Throwable $e) {
    respond(500, ['ok' => false, 'error' => $e->getMessage()]);
}