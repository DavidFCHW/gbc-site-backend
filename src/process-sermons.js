import { google } from 'googleapis';
import SpotifyWebApi from "spotify-web-api-node";
import dateFormat from 'dateformat';
import capitalizeTitle from 'capitalize-title';
import {createRequestParam, getDate, getSpeaker, getTimestampParam, getSeries, getThumbnailId} from './utils.js';
import * as dotenv from 'dotenv';

/*
TODO:
  1. Think about removing the createLivestreamObject, to reduce the amount of sermons processed.
  2. Add series to all of the YouTube sermon descriptions. ✅
  3. Investigate issue with not all video data being inserted into all-data.json/.csv ✅
  4. Think about hosting options for this script (do this when publishing the site).
  5. think about test scripts.
  6. Make sure credentials are not visible when pushing code to remote. ✅
  7. Use Github Actions for CI/CD,
  8. Change credentials from personal to church account.
  9. Change all-data filename to all-sermons.

 */


//API keys and secrets
dotenv.config();
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const api_key = process.env.API_KEY;

const youtubeBaseURL = 'https://youtube.com/watch?v=';
const driveImageBaseURL = 'https://drive.google.com/uc?id=';

export var data = {
  sermons: []
};

//IDs of public resources
const sermonPlaylistId = 'PLypLoRrvfFpPGiPdoDeeDA9Q9wzwTM5I8';
const livestreamPlaylistId = 'PLypLoRrvfFpPT3EdmDrUZ9IlVepySdMuz';
const gbcPodcastId = '1vaBG0PUEdA75ji6cr74d3';

//accessing the YouTube and Spotify APIs
const youtube = google.youtube({
  version: 'v3',
  auth: api_key
});

const spotify = new SpotifyWebApi ({
  clientId: client_id,
  clientSecret: client_secret
});


/**
 *
 * @param item
 */
async function createSermonObject(item) {
  let titleArray = item.snippet.title.split(' - ');
  let title = capitalizeTitle(titleArray[0].trim());
  let scripture = capitalizeTitle(titleArray[1].trim());
  let description = item.snippet.description;
  description = description === undefined ? description : description.toLowerCase();
  let videoId = item.contentDetails.videoId;
  let desArray = description.split('\n');
  let date_dirty = getDate(desArray);
  date_dirty = date_dirty === null ? item.contentDetails.videoPublishedAt : date_dirty;
  let date = dateFormat(date_dirty, 'dd mmm yyyy');
  // let date = dateFormat(date_dirty, 'mmmm dd, yyyy hh:mm pm');
  let series = getSeries(description);
  let speaker = getSpeaker(description);

  let sermon = {
    title: title,
    speaker: speaker,
    scripture: scripture,
    series: series,
    date_dirty: date_dirty,
    date: date,
    youtubeUrl: youtubeBaseURL + videoId,
    id: videoId
  }
  getThumbnailId(series).then(res =>
      sermon.thumbnail = driveImageBaseURL + res
  ).catch(err =>
      console.log(err)
  );
  data.sermons.push(sermon);
}

/**
 *
 * @param item
 */
async function createLivestreamObject(item) {
  let description = item.snippet.description.toLowerCase();
  let lines = description.split('\n');

  let title = lines.find(line => line.startsWith('title')).substring('title:'.length);
  title = capitalizeTitle(title.trim());

  let scripture = lines.find(line => line.includes('scripture:')).substring('scripture:'.length);
  scripture = capitalizeTitle(scripture.trim());

  let videoId = item.contentDetails.videoId;
  let urlParams = videoId + getTimestampParam(lines);

  let titleArray = item.snippet.title.split(' - ');
  let date_dirty = getDate(titleArray);
  date_dirty = date_dirty === null ? item.contentDetails.videoPublishedAt : date_dirty;
  let date = dateFormat(date_dirty, 'dd mmmm yyyy');
  // let date = dateFormat(getDate(titleArray), 'mmmm dd, yyyy hh:mm pm');
  let series = getSeries(description);
  let speaker = getSpeaker(description);

  let sermon = {
    title: title,
    speaker: speaker,
    series: series,
    scripture: scripture,
    date_dirty: date_dirty,
    date: date,
    youtubeUrl: youtubeBaseURL + urlParams,
    id: videoId
  }
  getThumbnailId(series).then(res => sermon.thumbnail = driveImageBaseURL + res).catch(err => console.log(err));
  data.sermons.push(sermon);
}

/**
 *
 * @param requestParam
 * @returns {Promise<void>}
 */
async function processData(requestParam) {
  let next = true;
  while (requestParam.pageToken || next) {
    await youtube.playlistItems.list(requestParam).then(res => {
      let items = res.data.items;
      if (items[0].snippet.title.toLowerCase().includes('service')) {
        items.forEach(createLivestreamObject);
      } else {
        items.forEach(createSermonObject);
      }

      if (res.data.nextPageToken) {
        requestParam.pageToken = res.data.nextPageToken;
      } else {
        delete requestParam.pageToken;
        next = false;
      }
    }).catch(err => {
      console.log(err);
    });
  }
}


await spotify.clientCredentialsGrant().then(res => {
  spotify.setAccessToken(res.body.access_token);
  return spotify.getShow(gbcPodcastId, {market: 'ES'});
}).then(res => {
  let items = res.body.episodes.items;
  items.forEach(item => {
    let title = item.name.split('-', 1)[0].trim();
    let link = item.external_urls.spotify;

    let index = data.sermons.findIndex(sermon => sermon.title.toLowerCase() === title.toLowerCase());
    if(index != -1) {
      data.sermons[index].spotifyURL = link;
    }
  });
}).catch(err => {
  console.log(err);
});

let sermonRequestParam = createRequestParam(sermonPlaylistId);
let livestreamRequestParam = createRequestParam(livestreamPlaylistId);

await processData(sermonRequestParam);
await processData(livestreamRequestParam);
