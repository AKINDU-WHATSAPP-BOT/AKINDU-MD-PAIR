
import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser } from '@whiskeysockets/baileys';
import { upload } from './mega.js';

const router = express.Router();

function removeFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { recursive: true, force: true });
        }
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    let dirs = './' + (num || `session`);
    await removeFile(dirs); // Remove any existing session

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const SUPUNMDInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: pino({ level: 'fatal' }),
                browser: ["Ubuntu", "Chrome", "20.0.04"],
            });

            // Always start connection update listener
            SUPUNMDInc.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(3000);

                    const sessionData = fs.readFileSync(dirs + '/creds.json');
                    const megaUrl = await upload(fs.createReadStream(`${dirs}/creds.json`), `session-${Date.now()}.json`);
                    let sessionId = 'RASHU-MD=' + megaUrl.replace('https://mega.nz/file/', '');

                    const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                    await SUPUNMDInc.sendMessage(userJid, { text: sessionId });

                    await SUPUNMDInc.sendMessage(userJid, {
                        text: "*𝐀𝐊𝐈𝐍𝐃𝐔 𝐌𝐃*\n\n" +
                              "*SESION SUCCESSFUL ✅*\n\n" +
                              "*උඩ ආපු Sesion Id එක ශෙයා කරන්න එපා හොදද ✅*\n\n" +
                              "+ ┉┉┉┉┉┉┉┉[ ❤️‍🩹 ]┉┉┉┉┉┉┉┉ +\n" +
                              "*❗𝐖𝐇𝐀𝐓𝐒𝐀𝐏𝐏 𝐆𝐑𝐎𝐔𝐏*\n" +
                              "https://chat.whatsapp.com/GGwN8bjWtCDKrm7kuNCc\n\n" +
                              "*❗𝐖𝐇𝐀𝐓𝐒𝐀𝐏𝐏 𝐂𝐇𝐀𝐍𝐍𝐄𝐋*\n" +
                              "https://whatsapp.com/channel/0029VaicB1MISTkGyQ7Bqe\n\n" +
                              "*𝐀𝐊𝐈𝐍𝐃𝐔 𝐌𝐃 𝐂𝐎𝐍𝐓𝐀𝐂𝐓*\n" +
                              "wa.me/947273190\n\n> *𝐀𝐊𝐈𝐍𝐃𝐔 𝐌𝐃*"
                    });

                    await delay(1000);
                    removeFile(dirs);
                    process.exit(0);
                } else if (connection === 'close') {
                    const code = lastDisconnect?.error?.output?.statusCode;
                    if (code !== 401) {
                        console.log('Reconnecting...');
                        await delay(5000);
                        initiateSession();
                    }
                }
            });

            // If not registered, respond with pairing code
            if (!SUPUNMDInc.authState.creds.registered) {
                await delay(2000);
                num = num.replace(/[^0-9]/g, '');
                const code = await SUPUNMDInc.requestPairingCode(num);
                if (!res.headersSent) {
                    res.send({ code });
                }
            } else {
                // Already linked account
                if (!res.headersSent) {
                    res.send({ status: 'linked', message: 'WhatsApp account already linked. Waiting to send session ID.' });
                }
            }

            SUPUNMDInc.ev.on('creds.update', saveCreds);

        } catch (err) {
            console.error('Session error:', err);
            if (!res.headersSent) {
                res.status(500).send({ error: 'Session failed. Try again.' });
            }
        }
    }

    await initiateSession();
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

export default router;