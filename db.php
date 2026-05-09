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
            $hash = (string)$row['password'];
            if (!password_verify($password, $hash)) respond(403, ['ok' => false, 'error' => 'Parolă greșită']);
            $_SESSION['userId'] = (int)$row['userId'];
            respond(200, ['ok' => true, 'mode' => 'login', 'userId' => (int)$row['userId'], 'username' => $username]);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt2 = $conn->prepare("INSERT INTO `user` (username, password) VALUES (?, ?)");
        $stmt2->bind_param("ss", $username, $hash);
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

        // Păstrează și în leaderboard (opțional în UI; top 10 îl luăm din logs)
        $stmt3 = $conn->prepare("INSERT INTO leaderboard (userId, scor) VALUES (?, ?)");
        $stmt3->bind_param("ii", $userId, $scor);
        $stmt3->execute();

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
        $stmt = $conn->prepare("
            SELECT 
              u.username,
              m.matrice_nume,
              l.scor
            FROM logs l
            JOIN `user` u ON u.userId = l.userId
            JOIN matrice m ON m.idMatrice = l.matriceId
            ORDER BY l.scor DESC, l.timestamp DESC
            LIMIT 10
        ");
        $stmt->execute();
        $res = $stmt->get_result();
        $rows = [];
        while ($r = $res->fetch_assoc()) $rows[] = $r;
        respond(200, ['ok' => true, 'top' => $rows]);
    }

    respond(404, ['ok' => false, 'error' => 'Action necunoscut sau metodă greșită']);
} catch (Throwable $e) {
    respond(500, ['ok' => false, 'error' => $e->getMessage()]);
}