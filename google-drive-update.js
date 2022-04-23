import {google} from "googleapis";
import fs from "fs";
import {authorisation} from "./get-auth.js";


/*
 TODO:
  1. find out how to update/replace an existing file. ✅
  2. define the scopes of api access. ✅
  3. find out how to modify folders. ✅
  4. Refactor code (make it clean, readable and efficient. Consider open/close principle) ✅
  5. find out how to take the token code from the redirect url. ✅
  6. Combine or decouple this with the process-sermons script. ✅
  7. Schedule its execution.
  8. Find out how to populate the dataset in wix with the file's data.
  9. Publish the app.
 */

const FILE_DATA = 'file_data.json';
const CSV_FILE = 'all-data.csv';


let fileExists = false;

//data to make google drive requests for file.
let fileMetadata = {
    name: 'all-data.csv',
    parents: []
};

let media = {
    mimeType: 'text/csv',
    body: fs.createReadStream(CSV_FILE)
};


/**
 * Calls check files by loading and passing credentials.
 * @returns {Promise<void>}
 */
async function doesFileExist() {
    await getFileParent();
    await checkFiles(authorisation);
}


/**
 * Retrieves the file id from json file.
 * @returns {*} The id of the file in Google Drive.
 */
function getFileId() {
    return JSON.parse(fs.readFileSync(FILE_DATA)).id;
}



/**
 * Checks if file exists in google drive and flips fileExists flag to true if it does.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function checkFiles() {
    await drive.files.list({
        pageSize: 10,
        fields: 'nextPageToken, files(id, name)',
        q: "name = 'all-data.csv'"
    }).then(res => {
        const files = res.data.files;
        console.log(res);
        if (files.length) {
            console.log('Files:');
            files.map((file) => {
                console.log(`${file.name} (${file.id})`);
            });
            fileExists = true;
        } else {
            console.log('No files found.');
            fileExists = false;
        }
    }).catch(err => {
        console.log('The API returned an error: ' + err);
    });
}


/**
 * Creates a file in google drive within a specific folder.
 */
async function createFile() {
    await drive.files.create({
        resource: fileMetadata,
        media: media
    }).then(res => {
        console.log(res)
        let fileId = res.data.id;
        let fileData = {
            id: fileId
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

/**
 * Updates a file in google drive.
 */
async function updateFile() {
    await drive.files.update({
        fileId: getFileId(),
        media: media
    }).then(res => {
        console.log(res);
        console.log(`The file ${res.data.name} (${res.data.id}) has been updated in ${fileMetadata.parents[0]}`)
    }).catch(err => {
        console.log(err, `\nPlease reset ${FILE_DATA}`);
    });
}

/**
 * Retrieves the parent folder of a file in google drive.
 * @returns {Promise<void>}
 */
async function getFileParent() {
    await drive.files.list({
        pageSize: 10,
        fields: 'nextPageToken, files(id, name)',
        q: "mimeType = 'application/vnd.google-apps.folder' and name = 'website test folder'"
    }).then(res => {
        console.log(res);
        let files = res.data.files;
        files.forEach(file => {
            fileMetadata.parents[0] = file.id;
            console.log(`The folder ${file.name} (${file.id}) has been found.`);
        })
    }).catch(err => {
        console.log(err);
    })
}

let auth = authorisation;

const drive = google.drive({
    version: 'v3',
    auth: auth
});

//Checks if file exists, if not then create it.
await doesFileExist();
if (fileExists) {
    await updateFile(auth);
} else {
    await createFile(auth);
}

