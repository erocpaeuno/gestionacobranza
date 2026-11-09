<?php
/**
 * API Backend para Gestión de Préstamos y Cobranzas
 * Compatible con hosting InfinityFree y bases de datos MySQL remotas.
 * 
 * Subir este archivo a la carpeta 'htdocs/' de tu cuenta en InfinityFree como: api.php
 */

// 1. Headers de CORS y Tipo de Contenido
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Responder a preflight requests de CORS (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Credenciales de la Base de Datos MySQL (InfinityFree)
$host     = "sql304.infinityfree.com";
$db_name  = "if0_41821681_gestion_prestamos";
$username = "if0_41821681";
$password = "O5jNJeRuJX";
$charset  = "utf8mb4";

// 3. Conexión PDO con MySQL
try {
    $dsn = "mysql:host={$host};dbname={$db_name};charset={$charset}";
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success"   => false,
        "connected" => false,
        "host"      => $host,
        "database"  => $db_name,
        "error"     => "Error al conectar con la base de datos MySQL: " . $e->getMessage(),
    ]);
    exit();
}

// 4. Obtención de Ruta y Método HTTP
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

if (empty($action)) {
    if (!empty($_SERVER['PATH_INFO'])) {
        $action = trim($_SERVER['PATH_INFO'], '/');
    } else {
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $parts = explode('api.php', $uri);
        if (count($parts) > 1 && !empty($parts[1])) {
            $action = trim($parts[1], '/');
        }
    }
}

if (empty($action)) {
    $action = 'status';
}

// Función auxiliar para leer cuerpo JSON
function getRequestBody() {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// 5. Router de Endpoints
try {
    switch ($action) {

        // ==========================================
        // 1. ESTADO DE CONEXIÓN (/status)
        // ==========================================
        case 'status': {
            $start = microtime(true);
            $tablesStmt = $pdo->query("SHOW TABLES");
            $tables = $tablesStmt->fetchAll(PDO::FETCH_NUM);
            $pingMs = round((microtime(true) - $start) * 1000);

            // Conteos de tablas principales (si existen)
            $counts = ['clientes' => 0, 'prestamos' => 0, 'cuotas' => 0, 'pagos' => 0];
            try {
                $counts['clientes']  = (int)$pdo->query("SELECT COUNT(*) FROM clientes")->fetchColumn();
                $counts['prestamos'] = (int)$pdo->query("SELECT COUNT(*) FROM prestamos")->fetchColumn();
                $counts['cuotas']    = (int)$pdo->query("SELECT COUNT(*) FROM cuotas")->fetchColumn();
                $counts['pagos']     = (int)$pdo->query("SELECT COUNT(*) FROM pagos")->fetchColumn();
            } catch (Exception $ex) {
                // Tablas aún no creadas
            }

            echo json_encode([
                "success"     => true,
                "connected"   => true,
                "database"    => $db_name,
                "host"        => $host,
                "port"        => 3306,
                "user"        => $username,
                "pingMs"      => $pingMs,
                "tablesCount" => count($tables),
                "counts"      => $counts,
            ]);
            break;
        }

        // ==========================================
        // 2. LOGIN DE USUARIOS (/login)
        // ==========================================
        case 'login': {
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(["success" => false, "error" => "Método no permitido"]);
                exit();
            }

            $body = getRequestBody();
            $userParam = trim($body['usuario'] ?? '');
            $passParam = trim($body['password'] ?? '');

            if (empty($userParam) || empty($passParam)) {
                http_response_code(400);
                echo json_encode(["success" => false, "error" => "Por favor ingresa usuario y contraseña"]);
                exit();
            }

            $stmt = $pdo->prepare("SELECT id, nombre, usuario, password, rol, activo, fecha_creacion FROM usuarios WHERE usuario = ? LIMIT 1");
            $stmt->execute([$userParam]);
            $user = $stmt->fetch();

            if (!$user) {
                http_response_code(401);
                echo json_encode(["success" => false, "error" => "Usuario o contraseña incorrectos"]);
                exit();
            }

            if (!$user['activo']) {
                http_response_code(403);
                echo json_encode(["success" => false, "error" => "Esta cuenta de usuario se encuentra desactivada"]);
                exit();
            }

            // Normalización y verificación de hash bcrypt
            $rawHash = $user['password'] ?? '';
            $isMatch = false;

            if (password_verify($passParam, $rawHash)) {
                $isMatch = true;
            } elseif (password_verify($passParam, str_replace('$2y$', '$2a$', $rawHash))) {
                $isMatch = true;
            } elseif ($passParam === $rawHash) {
                $isMatch = true; // Fallback texto plano si aplica
            }

            if (!$isMatch) {
                http_response_code(401);
                echo json_encode(["success" => false, "error" => "Usuario o contraseña incorrectos"]);
                exit();
            }

            echo json_encode([
                "success" => true,
                "message" => "Inicio de sesión exitoso",
                "user" => [
                    "id"             => (int)$user['id'],
                    "nombre"         => $user['nombre'],
                    "usuario"        => $user['usuario'],
                    "rol"            => $user['rol'],
                    "fecha_creacion" => $user['fecha_creacion'],
                ]
            ]);
            break;
        }

        // ==========================================
        // 3. LISTADO DE USUARIOS (/usuarios)
        // ==========================================
        case 'usuarios': {
            $stmt = $pdo->query("SELECT id, nombre, usuario, rol, activo, fecha_creacion FROM usuarios WHERE activo = 1 ORDER BY nombre ASC");
            $users = $stmt->fetchAll();
            $data = array_map(function($u) {
                return [
                    "id"             => (int)$u['id'],
                    "nombre"         => $u['nombre'],
                    "usuario"        => $u['usuario'],
                    "rol"            => $u['rol'],
                    "activo"         => (bool)$u['activo'],
                    "fecha_creacion" => $u['fecha_creacion'],
                ];
            }, $users);

            echo json_encode(["success" => true, "data" => $data]);
            break;
        }

        // ==========================================
        // 4. DATOS GENERALES CON ROL (/data)
        // ==========================================
        case 'data': {
            $userId  = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;
            $rol     = strtolower($_GET['rol'] ?? '');
            $isAdmin = ($rol === 'admin');

            $shouldFilter = (!$isAdmin && $userId !== null && $userId > 0);

            // Clientes
            $sqlClientes = "SELECT c.codigo, c.user_id, c.dni, c.apellidos, c.nombres, c.direccion, c.telefono, c.estado, 
                                   c.fecha_registro, c.fecha_modificacion, CAST(c.saldo_a_favor AS DOUBLE) as saldo_a_favor,
                                   u.nombre as owner_name, u.usuario as owner_username
                            FROM clientes c
                            LEFT JOIN usuarios u ON c.user_id = u.id";
            if ($shouldFilter) {
                $sqlClientes .= " WHERE c.user_id = " . (int)$userId;
            }
            $sqlClientes .= " ORDER BY c.fecha_registro DESC";
            $clientes = $pdo->query($sqlClientes)->fetchAll();

            // Préstamos
            $sqlPrestamos = "SELECT p.id, p.user_id, p.solicitud_id, p.cliente_dni, CAST(p.monto AS DOUBLE) as monto, 
                                    CAST(p.interes AS DOUBLE) as interes, p.plazo, p.tipo_credito, p.condicion, 
                                    p.fecha_desembolso, p.dias_pago, p.estado, p.fecha_creacion, p.fecha_modificacion, 
                                    p.observacion_anulacion, u.nombre as owner_name, u.usuario as owner_username
                             FROM prestamos p
                             LEFT JOIN usuarios u ON p.user_id = u.id";
            if ($shouldFilter) {
                $sqlPrestamos .= " WHERE p.user_id = " . (int)$userId;
            }
            $sqlPrestamos .= " ORDER BY p.fecha_creacion DESC";
            $prestamosRaw = $pdo->query($sqlPrestamos)->fetchAll();

            $prestamos = array_map(function($p) {
                $interes = (float)$p['interes'];
                if ($interes > 1) {
                    $interes = $interes / 100.0;
                }
                $p['interes'] = $interes;
                $p['monto']   = (float)$p['monto'];
                return $p;
            }, $prestamosRaw);

            // Cuotas
            $sqlCuotas = "SELECT id, user_id, prestamo_id, numero, fecha_vencimiento, CAST(monto AS DOUBLE) as monto, 
                                 CAST(monto_pagado AS DOUBLE) as monto_pagado, CAST(mora AS DOUBLE) as mora, dias_atraso, 
                                 estado, fecha_pago_real 
                          FROM cuotas";
            if ($shouldFilter) {
                $sqlCuotas .= " WHERE user_id = " . (int)$userId;
            }
            $sqlCuotas .= " ORDER BY prestamo_id ASC, numero ASC";
            $cuotas = $pdo->query($sqlCuotas)->fetchAll();

            // Pagos
            $sqlPagos = "SELECT id, user_id, prestamo_id, cuota_id, cuota_numero, cliente_dni, CAST(monto AS DOUBLE) as monto, 
                                CAST(mora AS DOUBLE) as mora, fecha_pago, fecha_vencimiento, fecha_registro, usado_saldo_a_favor 
                         FROM pagos";
            if ($shouldFilter) {
                $sqlPagos .= " WHERE user_id = " . (int)$userId;
            }
            $sqlPagos .= " ORDER BY fecha_registro DESC";
            $pagos = $pdo->query($sqlPagos)->fetchAll();

            // Configuración
            $sqlConfig = $shouldFilter
                ? "SELECT user_id, nombre_marca, telefono, direccion, representante, dni_representante, logo_base64 FROM usuarios_config WHERE user_id = ? LIMIT 1"
                : "SELECT user_id, nombre_marca, telefono, direccion, representante, dni_representante, logo_base64 FROM usuarios_config LIMIT 1";
            $stmtConf = $pdo->prepare($sqlConfig);
            $stmtConf->execute($shouldFilter ? [$userId] : []);
            $config = $stmtConf->fetch();

            if (!$config) {
                $config = [
                    "user_id"           => $userId ?: 1,
                    "nombre_marca"      => "GESTIÓN DE PRÉSTAMOS",
                    "telefono"          => "",
                    "direccion"         => "",
                    "representante"     => "",
                    "dni_representante" => "",
                    "logo_base64"       => null,
                ];
            }

            echo json_encode([
                "success"       => true,
                "source"        => "InfinityFree MySQL: " . $db_name,
                "isAdmin"       => $isAdmin,
                "userId"        => $userId,
                "filterApplied" => $shouldFilter,
                "timestamp"     => date('c'),
                "data"          => [
                    "clientes"  => $clientes,
                    "prestamos" => $prestamos,
                    "cuotas"    => $cuotas,
                    "pagos"     => $pagos,
                    "config"    => $config,
                ]
            ]);
            break;
        }

        // ==========================================
        // 5. PROCESAR O CONSULTAR PAGOS (/pagos)
        // ==========================================
        case 'pagos': {
            if ($method === 'GET') {
                $subAction = $_GET['sub_action'] ?? ($_GET['action_type'] ?? 'list');
                $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;
                $userFilter = $userId ? "p.user_id = " . (int)$userId : "1=1";

                if ($subAction === 'byPrestamo') {
                    $pId = $_GET['id'] ?? '';
                    $stmt = $pdo->prepare("SELECT p.*, u.nombre as owner_name FROM pagos p LEFT JOIN usuarios u ON p.user_id = u.id WHERE p.prestamo_id = ? AND {$userFilter} ORDER BY p.fecha_registro DESC");
                    $stmt->execute([$pId]);
                    echo json_encode(["success" => true, "data" => $stmt->fetchAll()]);
                    exit();
                }

                if ($subAction === 'byFecha') {
                    $f = $_GET['fecha'] ?? date('Y-m-d');
                    $stmt = $pdo->prepare("SELECT p.*, u.nombre as owner_name FROM pagos p LEFT JOIN usuarios u ON p.user_id = u.id WHERE p.fecha_pago = ? AND {$userFilter} ORDER BY p.fecha_registro DESC");
                    $stmt->execute([$f]);
                    echo json_encode(["success" => true, "data" => $stmt->fetchAll()]);
                    exit();
                }

                // Default: listado general
                $stmt = $pdo->query("SELECT p.*, u.nombre as owner_name FROM pagos p LEFT JOIN usuarios u ON p.user_id = u.id WHERE {$userFilter} ORDER BY p.fecha_registro DESC");
                echo json_encode(["success" => true, "data" => $stmt->fetchAll()]);
                exit();
            }

            // POST: Registrar pago
            $body = getRequestBody();
            $pdo->beginTransaction();

            $prestamoId = '';
            $clienteDni = '';
            $fechaPago = date('Y-m-d');
            $itemsPagos = [];
            $usarSaldo = false;
            $fallbackOwnerId = 1;

            if (!empty($body['prestamoId']) && !empty($body['clienteDni']) && !empty($body['pagos'])) {
                $prestamoId = trim($body['prestamoId']);
                $clienteDni = trim($body['clienteDni']);
                $fechaPago  = !empty($body['fechaPago']) ? trim($body['fechaPago']) : $fechaPago;
                $itemsPagos = $body['pagos'];
                $usarSaldo  = !empty($body['usarSaldo']);
            } elseif (!empty($body['recibo']) && !empty($body['updatedCliente']) && !empty($body['updatedPrestamo'])) {
                $prestamoId = trim($body['updatedPrestamo']['id']);
                $clienteDni = trim($body['updatedCliente']['dni']);
                $fallbackOwnerId = $body['updatedPrestamo']['user_id'] ?? 1;
                $usarSaldo = ((float)($body['recibo']['saldo_favor_usado'] ?? 0)) > 0;

                if (!empty($body['recibo']['cuotas_afectadas'])) {
                    foreach ($body['recibo']['cuotas_afectadas'] as $c) {
                        $itemsPagos[] = [
                            'cuotaId'     => (int)($c['id'] ?? 0),
                            'cuotaNumero' => (int)($c['numero'] ?? 0),
                            'monto'       => (float)($c['monto'] ?? 0),
                            'mora'        => (float)($c['mora'] ?? 0),
                            'diasAtraso'  => 0,
                        ];
                    }
                }
            }

            if (empty($prestamoId) || empty($clienteDni) || empty($itemsPagos)) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(["success" => false, "error" => "Datos de pago incompletos"]);
                exit();
            }

            // Obtener user_id propietario del préstamo
            $stmtOwner = $pdo->prepare("SELECT user_id FROM prestamos WHERE id = ?");
            $stmtOwner->execute([$prestamoId]);
            $ownerRow = $stmtOwner->fetch();
            $loanOwnerId = $ownerRow ? (int)$ownerRow['user_id'] : $fallbackOwnerId;

            // Manejo de saldo a favor
            $totalAPagar = 0;
            foreach ($itemsPagos as $item) { $totalAPagar += (float)($item['monto'] ?? 0); }
            $saldoDisponible = 0;

            if ($usarSaldo) {
                $stmtSaldo = $pdo->prepare("SELECT saldo_a_favor FROM clientes WHERE dni = ? AND user_id = ? FOR UPDATE");
                $stmtSaldo->execute([$clienteDni, $loanOwnerId]);
                $saldoRow = $stmtSaldo->fetch();
                $saldoDisponible = $saldoRow ? (float)$saldoRow['saldo_a_favor'] : 0.0;

                $saldoTotalAUsar = min($saldoDisponible, $totalAPagar);
                if ($saldoTotalAUsar > 0) {
                    $stmtUpdCli = $pdo->prepare("UPDATE clientes SET saldo_a_favor = saldo_a_favor - ?, fecha_modificacion = NOW() WHERE dni = ? AND user_id = ?");
                    $stmtUpdCli->execute([$saldoTotalAUsar, $clienteDni, $loanOwnerId]);
                }
            }

            // Aplicar pagos a cada cuota
            foreach ($itemsPagos as $p) {
                $cuotaId     = (int)($p['cuotaId'] ?? 0);
                $cuotaNumero = (int)($p['cuotaNumero'] ?? 0);
                $montoTotal  = (float)($p['monto'] ?? 0);
                $mora        = (float)($p['mora'] ?? 0);
                $diasAtraso  = (int)($p['diasAtraso'] ?? 0);
                $vencimiento = $p['fechaVencimiento'] ?? '';

                if (($cuotaId === 0 && $cuotaNumero === 0) || ($montoTotal <= 0 && $mora <= 0)) {
                    continue;
                }

                $stmtC = null;
                if ($cuotaId > 0) {
                    $stmtC = $pdo->prepare("SELECT id, user_id, prestamo_id, numero, fecha_vencimiento, monto, monto_pagado FROM cuotas WHERE id = ?");
                    $stmtC->execute([$cuotaId]);
                } elseif ($cuotaNumero > 0) {
                    $stmtC = $pdo->prepare("SELECT id, user_id, prestamo_id, numero, fecha_vencimiento, monto, monto_pagado FROM cuotas WHERE prestamo_id = ? AND numero = ?");
                    $stmtC->execute([$prestamoId, $cuotaNumero]);
                }
                $cRow = $stmtC ? $stmtC->fetch() : null;
                if (!$cRow) continue;

                $actualCuotaId     = (int)$cRow['id'];
                $actualUserId      = (int)$cRow['user_id'];
                $actualPrestamoId  = $cRow['prestamo_id'];
                $actualNumero      = (int)$cRow['numero'];
                if (empty($vencimiento)) {
                    $vencimiento = $cRow['fecha_vencimiento'] ?: $fechaPago;
                }

                $montoDeSaldo = 0;
                $montoEfectivo = $montoTotal;

                if ($usarSaldo && $saldoDisponible > 0) {
                    $montoDeSaldo  = min($montoTotal, $saldoDisponible);
                    $montoEfectivo = $montoTotal - $montoDeSaldo;
                    $saldoDisponible -= $montoDeSaldo;
                }

                // Registrar parte pagada con saldo
                if ($montoDeSaldo > 0) {
                    $pagoId = "PAG-" . round(microtime(true) * 1000) . "-" . rand(100, 999);
                    $stmtInsP = $pdo->prepare("INSERT INTO pagos (id, user_id, prestamo_id, cuota_id, cuota_numero, cliente_dni, monto, mora, fecha_pago, fecha_vencimiento, fecha_registro, usado_saldo_a_favor) VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, NOW(), 1)");
                    $stmtInsP->execute([$pagoId, $actualUserId, $actualPrestamoId, $actualCuotaId, $actualNumero, $clienteDni, $montoDeSaldo, $fechaPago, $vencimiento]);
                }

                // Registrar parte pagada en efectivo / mora
                if ($montoEfectivo > 0 || ($montoTotal <= 0 && $mora > 0)) {
                    $pagoId = "PAG-" . round(microtime(true) * 1000) . "-" . rand(100, 999);
                    $stmtInsP = $pdo->prepare("INSERT INTO pagos (id, user_id, prestamo_id, cuota_id, cuota_numero, cliente_dni, monto, mora, fecha_pago, fecha_vencimiento, fecha_registro, usado_saldo_a_favor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 0)");
                    $stmtInsP->execute([$pagoId, $actualUserId, $actualPrestamoId, $actualCuotaId, $actualNumero, $clienteDni, $montoEfectivo, $mora, $fechaPago, $vencimiento]);
                }

                // Actualizar cuota
                $stmtUpdCuota = $pdo->prepare("UPDATE cuotas SET monto_pagado = monto_pagado + ?, mora = mora + ?, dias_atraso = ?, fecha_pago_real = ? WHERE id = ? AND user_id = ?");
                $stmtUpdCuota->execute([$montoTotal, $mora, $diasAtraso, $fechaPago, $actualCuotaId, $actualUserId]);

                // Verificar si quedó pagada al 100%
                $stmtCheck = $pdo->prepare("SELECT monto, monto_pagado FROM cuotas WHERE id = ? AND user_id = ?");
                $stmtCheck->execute([$actualCuotaId, $actualUserId]);
                $cData = $stmtCheck->fetch();
                if ($cData && ((float)$cData['monto_pagado'] >= (float)$cData['monto'])) {
                    $pdo->prepare("UPDATE cuotas SET estado = 'PAGADO' WHERE id = ? AND user_id = ?")->execute([$actualCuotaId, $actualUserId]);
                }
            }

            // Verificar si el préstamo se terminó
            $stmtPend = $pdo->prepare("SELECT COUNT(*) FROM cuotas WHERE prestamo_id = ? AND user_id = ? AND estado != 'PAGADO'");
            $stmtPend->execute([$prestamoId, $loanOwnerId]);
            $pendientes = (int)$stmtPend->fetchColumn();

            $terminado = false;
            if ($pendientes === 0) {
                $pdo->prepare("UPDATE prestamos SET estado = 'TERMINADO', fecha_modificacion = NOW() WHERE id = ? AND user_id = ?")->execute([$prestamoId, $loanOwnerId]);
                $terminado = true;
            }

            $pdo->commit();
            echo json_encode([
                "success"   => true,
                "terminado" => $terminado,
                "message"   => "Pago registrado exitosamente en MySQL"
            ]);
            break;
        }

        // ==========================================
        // 6. REGISTRAR AMORTIZACIÓN (/amortizacion)
        // ==========================================
        case 'amortizacion': {
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(["success" => false, "error" => "Método no permitido"]);
                exit();
            }

            $body = getRequestBody();
            $recibo          = $body['recibo'] ?? null;
            $updatedCliente  = $body['updatedCliente'] ?? null;
            $updatedPrestamo = $body['updatedPrestamo'] ?? null;
            $updatedCuotas   = $body['updatedCuotas'] ?? null;

            if (!$recibo || !$updatedCliente || !$updatedPrestamo || !$updatedCuotas) {
                http_response_code(400);
                echo json_encode(["success" => false, "error" => "Datos de amortización incompletos"]);
                exit();
            }

            $pdo->beginTransaction();

            $prestamoId = $updatedPrestamo['id'];
            $stmtP = $pdo->prepare("SELECT id, user_id FROM prestamos WHERE id = ?");
            $stmtP->execute([$prestamoId]);
            $pData = $stmtP->fetch();
            $userId = $pData ? (int)$pData['user_id'] : ($updatedPrestamo['user_id'] ?? 1);
            $today = date('Y-m-d');

            // Actualizar cuotas modificadas
            $stmtUpdC = $pdo->prepare("UPDATE cuotas SET monto = ?, monto_pagado = ?, mora = ?, estado = ?, fecha_pago_real = ? WHERE id = ? AND user_id = ?");
            foreach ($updatedCuotas as $c) {
                if ($c['prestamo_id'] === $prestamoId) {
                    $fechaReal = $c['fecha_pago_real'] ?? ($c['estado'] === 'PAGADO' ? $today : null);
                    $stmtUpdC->execute([
                        (float)$c['monto'],
                        (float)($c['monto_pagado'] ?? 0),
                        (float)($c['mora'] ?? 0),
                        $c['estado'],
                        $fechaReal,
                        (int)$c['id'],
                        $userId
                    ]);
                }
            }

            // Actualizar préstamo
            $pdo->prepare("UPDATE prestamos SET estado = ?, fecha_modificacion = NOW() WHERE id = ? AND user_id = ?")
                ->execute([$updatedPrestamo['estado'], $prestamoId, $userId]);

            // Actualizar cliente (saldo a favor)
            $pdo->prepare("UPDATE clientes SET saldo_a_favor = ?, fecha_modificacion = NOW() WHERE dni = ? AND user_id = ?")
                ->execute([(float)($updatedCliente['saldo_a_favor'] ?? 0), $updatedCliente['dni'], $userId]);

            // Registrar registro en tabla pagos
            $pagoId = "AMORT-" . round(microtime(true) * 1000) . "-" . rand(100, 999);
            $refCuotaStmt = $pdo->prepare("SELECT id, numero, fecha_vencimiento FROM cuotas WHERE prestamo_id = ? AND user_id = ? ORDER BY numero ASC LIMIT 1");
            $refCuotaStmt->execute([$prestamoId, $userId]);
            $refCuota = $refCuotaStmt->fetch();

            if ($refCuota) {
                $stmtInsP = $pdo->prepare("INSERT INTO pagos (id, user_id, prestamo_id, cuota_id, cuota_numero, cliente_dni, monto, mora, fecha_pago, fecha_vencimiento, fecha_registro, usado_saldo_a_favor) VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, NOW(), ?)");
                $stmtInsP->execute([
                    $pagoId,
                    $userId,
                    $prestamoId,
                    (int)$refCuota['id'],
                    (int)$refCuota['numero'],
                    $updatedCliente['dni'],
                    (float)$recibo['total_cobrado'],
                    $today,
                    $refCuota['fecha_vencimiento'] ?: $today,
                    ((float)($recibo['saldo_favor_usado'] ?? 0) > 0) ? 1 : 0
                ]);
            }

            $pdo->commit();
            echo json_encode(["success" => true, "message" => "Amortización guardada exitosamente en MySQL"]);
            break;
        }

        // ==========================================
        // 7. ANULAR PRÉSTAMO (/anular-prestamo)
        // ==========================================
        case 'anular-prestamo': {
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(["success" => false, "error" => "Método no permitido"]);
                exit();
            }

            $body = getRequestBody();
            $prestamoId = trim($body['prestamo_id'] ?? '');
            $motivo     = trim($body['motivo'] ?? 'Anulado por usuario');

            if (empty($prestamoId)) {
                http_response_code(400);
                echo json_encode(["success" => false, "error" => "ID de préstamo requerido"]);
                exit();
            }

            $stmt = $pdo->prepare("UPDATE prestamos SET estado = 'ANULADO', observacion_anulacion = ?, fecha_modificacion = NOW() WHERE id = ?");
            $stmt->execute([$motivo, $prestamoId]);

            echo json_encode(["success" => true, "message" => "Préstamo anulado exitosamente en MySQL"]);
            break;
        }

        // ==========================================
        // 8. GUARDAR O ACTUALIZAR CLIENTE (/clientes)
        // ==========================================
        case 'clientes': {
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(["success" => false, "error" => "Método no permitido"]);
                exit();
            }

            $c = getRequestBody();
            if (empty($c['dni']) || empty($c['nombres']) || empty($c['apellidos'])) {
                http_response_code(400);
                echo json_encode(["success" => false, "error" => "Datos de cliente incompletos"]);
                exit();
            }

            $stmt = $pdo->prepare("
                INSERT INTO clientes (codigo, user_id, dni, apellidos, nombres, direccion, telefono, estado, saldo_a_favor, fecha_registro)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                apellidos = VALUES(apellidos),
                nombres = VALUES(nombres),
                direccion = VALUES(direccion),
                telefono = VALUES(telefono),
                estado = VALUES(estado),
                saldo_a_favor = VALUES(saldo_a_favor),
                fecha_modificacion = NOW()
            ");

            $codigo = $c['codigo'] ?? ('C' . rand(10000, 99999));
            $userId = $c['user_id'] ?? 1;

            $stmt->execute([
                $codigo,
                $userId,
                $c['dni'],
                $c['apellidos'],
                $c['nombres'],
                $c['direccion'] ?? '',
                $c['telefono'] ?? '',
                $c['estado'] ?? 'ACTIVO',
                (float)($c['saldo_a_favor'] ?? 0.0)
            ]);

            echo json_encode(["success" => true, "message" => "Cliente guardado en MySQL"]);
            break;
        }

        // ==========================================
        // 9. GUARDAR CONFIGURACIÓN EMPRESA (/config)
        // ==========================================
        case 'config': {
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(["success" => false, "error" => "Método no permitido"]);
                exit();
            }

            $conf = getRequestBody();
            if (empty($conf['nombre_marca'])) {
                http_response_code(400);
                echo json_encode(["success" => false, "error" => "Configuración inválida"]);
                exit();
            }

            $stmt = $pdo->prepare("
                INSERT INTO usuarios_config (user_id, nombre_marca, telefono, direccion, representante, dni_representante, logo_base64)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                nombre_marca = VALUES(nombre_marca),
                telefono = VALUES(telefono),
                direccion = VALUES(direccion),
                representante = VALUES(representante),
                dni_representante = VALUES(dni_representante),
                logo_base64 = VALUES(logo_base64)
            ");

            $stmt->execute([
                $conf['user_id'] ?? 1,
                $conf['nombre_marca'],
                $conf['telefono'] ?? null,
                $conf['direccion'] ?? null,
                $conf['representante'] ?? null,
                $conf['dni_representante'] ?? null,
                $conf['logo_base64'] ?? null
            ]);

            echo json_encode(["success" => true, "message" => "Configuración guardada en MySQL"]);
            break;
        }

        default: {
            http_response_code(404);
            echo json_encode([
                "success" => false,
                "error"   => "Ruta no encontrada: {$action}",
                "rutas_disponibles" => [
                    "GET  api.php?action=status",
                    "POST api.php?action=login",
                    "GET  api.php?action=usuarios",
                    "GET  api.php?action=data&user_id={id}&rol={rol}",
                    "GET  api.php?action=pagos",
                    "POST api.php?action=pagos",
                    "POST api.php?action=amortizacion",
                    "POST api.php?action=anular-prestamo",
                    "POST api.php?action=clientes",
                    "POST api.php?action=config"
                ]
            ]);
            break;
        }
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error"   => $e->getMessage()
    ]);
}
