import capitalizeTitle from "capitalize-title";
import {authorisation} from "./get-google-auth.js";
import {google} from "googleapis";

let months = new Map();

months.set('January', 0);
months.set('February', 1);
months.set('March', 2);
months.set('April', 3);
months.set('May', 4);
months.set('June', 5);
months.set('July', 6);
months.set('August', 7);
months.set('September', 8);
months.set('October', 9);
months.set('November', 10);
months.set('December', 11);


const drive = google.drive({
    version: 'v3',
    auth: authorisation
});


//Utility functions

/**
 * creates the request parameters for the api call.
 * @param playlistId
 * @returns {{playlistId, maxResults: number, part: string}}
 */
export function createRequestParam(playlistId) {
    let requestParam = {
        part: 'contentDetails,snippet',
        playlistId: playlistId,
        maxResults: 50
    }
    return requestParam;
}


export async function getThumbnailId(seriesTitle) {
    seriesTitle = seriesTitle.toLowerCase();
    let id;
    await drive.files.list({
        pageSize: 30,
        fields: 'nextPageToken, files(id, name)',
        // q: "mimeType contains 'image/'"
        q: "parents = '1mA5sXHDpQFvJysiGS3AhtXzNVNkm46E_'"
    }).then(res => {
        let files = res.data.files;
        // console.log(files);
        if (files.length) {
            let file;
            file = files.find(f => f.name.toLowerCase().includes(seriesTitle));
            if (file === undefined) {
                console.log(`Thumbnail for series:  '${seriesTitle}'  not found.`);
            } else {
                id = file.id;
            }
        }
    }).catch(e => {
        console.log(e);
    });
    return id;
}



/**
 *
 * @param description
 * @returns {string}
 */
export function getSeries(description) {
    if (description.includes("series:")) {
        let desArray = description.split("\n");
        let series = desArray.find(line => line.includes("series:")).split(':')[1].trim();
        series = capitalizeTitle(series);
        return series;
    } else {
        return "default";
    }
}


/**
 *
 * @param description
 * @returns {string}
 */
export function getSpeaker(description) {
    if (description.includes("speaker")) {
        let desArray = description.split("\n");
        let speaker = desArray.find(line => line.includes("speaker")).split(':')[1].trim();
        speaker = capitalizeTitle(speaker);
        return speaker;
    }
}

/**
 *
 * @param lines
 * @returns {string}
 */
export function getTimestampParam(lines) {
    let timestamp = lines.find(line => line.includes("sermon")).split('-')[0].trim();
    return '&t=' + convertTimestampToSeconds(timestamp) + 's';
}

/**
 *
 * @param timestamp
 * @returns {number|*}
 */
function convertTimestampToSeconds(timestamp) {
    let time = timestamp.split(':');
    let hrs = 0;
    let mins = 0;
    let seconds = 0;
    if (time.length === 2) {
        mins = Number.parseInt(time[0]);
        seconds = Number.parseInt(time[1]);
        let result = (60 * mins) + seconds;
        return result;
    } else {
        hrs = time[0];
        mins = time[1];
        seconds = time[2];
        let result = (3600 * hrs) + (60 * mins) + seconds;
        return result;
    }
}

/**
 *
 * @param array
 * @returns {null|Date}
 */
export function getDate(array) {
    if (array.length === 2 && array[0].toLowerCase().includes('service')) {
        let date = array[1];
        date = date.trim().split(' ');
        date[0] = date[0].replace(/\D/g, '');
        date[1] = months.get(date[1]);
        date = new Date(date[2], date[1], date[0]);
        return date;
    } else {
        let str = array.find(line => line.toLowerCase().startsWith('date'));
        if (str != undefined) {
            let date = array.filter(line => line.includes("date"))[0].split(':')[1].trim();
            let dateSplit = date.split('/');
            date = new Date(dateSplit[2], dateSplit[1] - 1, dateSplit[0]);
            return date;
        } else {
            return null;
        }
    }
}