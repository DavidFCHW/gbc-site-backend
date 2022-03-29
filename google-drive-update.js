import {google} from "googleapis";
import readline from 'readline';
import fs from "fs";

/*
 TODO:
  1. find out how to update/replace an existing file. ✅
  2. define the scopes of api access. ✅
  3. find out how to modify folders. ✅
  4. Refactor code (make it clean, readable and efficient. Consider open/close principle)
    - find out how to take the token code from the redirect url.
  5. Combine or decouple this with the process-sermons script.
  6. Make an api call on Wix to retrieve file and schedule its execution.
 */

const FILE_DATA = 'file_data.json';
let credentials;
let oAuth2Client;

var fileMetadata = {
    name: 'all-data.csv',
    parents: ['1r7ppm5f8Vmr-bgThqMtdK40fa_SvFrlS']
};
var media = {
    mimeType: 'text/csv',
    body: fs.createReadStream('all-data.csv')
};

function getFileId() {
    return JSON.parse(fs.readFileSync(FILE_DATA)).id;
}

/**
 * Sample from Google. Modify for purpose.
 * @type {string[]}
 */

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) {
        return console.log('Error loading client secret file:', err);
    }
    // Authorize a client with credentials, then call the Google Drive API.
    credentials = JSON.parse(content);
    authorize(credentials, updateFile);
});


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials,callback) {
    const {client_secret, client_id, redirect_uris} = credentials.web;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) {
            return getAccessToken(oAuth2Client, callback);
        }
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) {
                return console.error('Error retrieving access token', err);
            }
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
    const drive = google.drive({
        version: 'v3',
        auth: auth
    });
    drive.files.list({
        pageSize: 10,
        fields: 'nextPageToken, files(id, name)'
    }, (err, res) => {
        if (err) {
            return console.log('The API returned an error: ' + err);
        }
        const files = res.data.files;
        console.log(res);
        if (files.length) {
            console.log('Files:');
            files.map((file) => {
                console.log(`${file.name} (${file.id})`);
            });

        } else {
            console.log('No files found.');
        }
    });
}

function createFile(auth) {
    const drive = google.drive({version: 'v3', auth});
    drive.files.create({
        resource: fileMetadata,
        media: media
    }).then(res => {
        console.log(res)
        let fileId = res.data.id;
        let fileData = {
            id: fileId,
            exists: true
        };
        console.log(`The file: ${fileMetadata.name} (${fileId}) has been created.`);
        fs.writeFile(FILE_DATA, JSON.stringify(fileData), err => {
            if (err) {
                console.log(err);
            }
            console.log('File data saved to', FILE_DATA);
        });
    }).catch(err => console.log(err));
}

function updateFile(auth) {
    const drive = google.drive({
        version: 'v3',
        auth: auth
    });
    drive.files.update({
        fileId: getFileId(),
        media: media
    }).then(res => {
        console.log(res);
        console.log(`The file ${res.data.name} (${res.data.id}) has been updated in  `)
    }).catch(err => console.log(err));
}

