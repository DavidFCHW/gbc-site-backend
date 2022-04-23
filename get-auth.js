import {google} from "googleapis";
import fs from 'fs';
import open from "opn";
import express from "express";


//server constants
const app = express();
const port = process.env.PORT || 8080;

let authorisation; //OAuth2Client object

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];
/* The file token.json stores the user's access and refresh tokens, and is
 created automatically when the authorization flow completes for the first
 time. */
const TOKEN_PATH = 'token.json';

/**
 * Load credentials json file
 * @param apiCall
 */
function loadAuth() {
    // Load client secrets from a local file.
    let content = fs.readFileSync('credentials.json');
    // Authorize a client with credentials, then call the Google Drive API.
    let credentials = JSON.parse(content);
    authorisation = authorize(credentials);
    return authorisation;
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.web;
    authorisation = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    let token;
    if(fs.existsSync(TOKEN_PATH)) {
        token = fs.readFileSync(TOKEN_PATH);
        authorisation.setCredentials(JSON.parse(token));
        return authorisation;
    } else {
        return getAccessToken(authorisation);
    }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(auth) {
    const authUrl = auth.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);

    let server = app.listen(port, 'localhost');
    console.log("Server started at http://localhost:" + port);

    open(authUrl, {
        app: 'google chrome'
    });
    let token_code;
    app.get("/", (req, res) => {
        token_code = req.query.code;
        console.log(token_code);
        res.send({
            'code': token_code
        });
        req.destroy();
    });
    setTimeout(() => {
        auth.getToken(token_code, (err, token) => {
            if (err) {
                return console.error('Error retrieving access token', err);
            }
            auth.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            // server.removeAllListeners();
            server.close();
            console.log("server has now closed");
            return auth;
        });
    }, 9000);

}

loadAuth();

export {authorisation};