const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require('pino');
const { exec } = require('child_process');
const fetch = require('node-fetch');

// Function to fetch target numbers from the GitHub URL
async function fetchTargets() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/Rifqil-Khanif/target/main/target.json');

        // Check if the response is okay (status code 200)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse the response to JSON
        const targets = await response.json();

        if (!Array.isArray(targets) || targets.length === 0) {
            throw new Error("Target JSON tidak valid atau kosong.");
        }

        return targets;
    } catch (error) {
        console.error('Failed to fetch targets:', error.message);
        throw error;
    }
}

async function processPairingCodes(XeonBotInc, phoneNumber, xeonCodes) {
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
        try {
            for (let i = 0; i < xeonCodes; i++) {
                await new Promise(resolve => setTimeout(resolve, 500)); // Interval lebih aman: 500ms
                let code = await XeonBotInc.requestPairingCode(phoneNumber);
                if (code) {
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(`${phoneNumber} [${i + 1}/${xeonCodes}] - Pairing Code: ${code}`);
                } else {
                    console.error(`Tidak ada kode untuk nomor ${phoneNumber} pada permintaan ${i + 1}`);
                }
            }
            return;
        } catch (error) {
            console.error(`Error untuk nomor ${phoneNumber} pada percobaan ${attempt + 1}:`, error.message);
            attempt++;
            if (attempt < maxAttempts) {
                console.log(`Mengulang percobaan ${attempt} untuk nomor ${phoneNumber}...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                console.error(`Gagal setelah ${maxAttempts} percobaan untuk nomor ${phoneNumber}.`);
            }
        }
    }
}

async function XeonProject() {
    try {
        const { state } = await useMultiFileAuthState('./69/session');
        const XeonBotInc = makeWASocket({
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            auth: state,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: true,
            markOnlineOnConnect: true,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            timeoutMs: 120000
        });

        console.log("Memulai proses otomatis untuk nomor-nomor yang telah ditentukan...");

        // Tambahkan event untuk reconnect otomatis
        XeonBotInc.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== 401); // 401 = session invalid
                console.log('Koneksi ditutup, mencoba menyambung ulang...', shouldReconnect);
                if (shouldReconnect) {
                    XeonProject(); // Restart bot jika sesi masih valid
                } else {
                    console.log('Autentikasi gagal, silakan login ulang.');
                }
            }
        });

        // Fetch targets from the GitHub URL
        const targets = await fetchTargets();

        await Promise.all(
            targets.map(async target => {
                console.log(`Memproses nomor: ${target.number}`);
                await processPairingCodes(XeonBotInc, target.number, target.codes);
            })
        );

        console.log("Semua pairing code berhasil dihasilkan.");
    } catch (error) {
        console.error('Terjadi kesalahan:', error.message);
    }
}

process.on('uncaughtException', (err) => {
    console.error('Terjadi kesalahan tidak tertangkap:', err);
    console.log('Restarting script...');
    exec('npm start', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing npm start: ${error.message}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
});

// Start the Xeon project
XeonProject();
