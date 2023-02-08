import { google } from 'googleapis';
import SpotifyWebApi from "spotify-web-api-node";
import dateFormat from 'dateformat';
import capitalizeTitle from 'capitalize-title';
import {createRequestParam, getDate, getSpeaker, getTimestampParam, getSeries, getThumbnailId} from './utils.js';
import * as dotenv from 'dotenv';


//API keys and secrets
dotenv.config(); //loads secrets in .env file to process.env
const spotify_client_id = process.env.SPOTIFY_CLIENT_ID;
const spotify_client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const api_key = process.env.YOUTUBE_API_KEY;

const youtubeBaseURL = 'https://youtube.com/watch?v=';
const driveImageBaseURL = 'https://drive.google.com/uc?id='; // for thumbnails

//an object containing the array of all the sermon data in objects.
export var data = {
  sermons: []
};

//IDs of public resources
const sermonPlaylistId = 'PLypLoRrvfFpP2Xt2SVomp3KwJeXa0B1rm';
const livestreamPlaylistId = 'PLypLoRrvfFpPT3EdmDrUZ9IlVepySdMuz';
const gbcPodcastId = '1vaBG0PUEdA75ji6cr74d3';

//accessing the YouTube and Spotify APIs
const youtube = google.youtube({
  version: 'v3',
  auth: api_key
});

const spotify = new SpotifyWebApi ({
  clientId: spotify_client_id,
  clientSecret: spotify_client_secret
});


/**
 * Takes in video object from YouTube API response and takes the key metadata
 * to create an object for a sermon and pushes it to the data object array.
 * @param video
 */
async function createSermonObject(video) {
  let titleArray = video.snippet.title.split(' - ');
  let title = capitalizeTitle(titleArray[0].trim());
  let scripture = capitalizeTitle(titleArray[1].trim());
  let description = video.snippet.description;
  description = description === undefined ? description : description.toLowerCase();
  let videoId = video.contentDetails.videoId;
  let desArray = description.split('\n');
  let date_dirty = getDate(desArray);
  date_dirty = date_dirty === null ? video.contentDetails.videoPublishedAt : date_dirty;
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
 * Takes in video (livestream) object from YouTube API response and takes the key metadata
 * to create an object for a sermon and pushes it to the data object array.
 * @param video
 */
async function createLivestreamObject(video) {
  let description = video.snippet.description.toLowerCase();
  let lines = description.split('\n');

  let title = lines.find(line => line.startsWith('title'))
      if(title === undefined) {
        return;
      } else {
        title.substring('title:'.length);
      }
  title = capitalizeTitle(title.trim());

  let scripture = lines.find(line => line.includes('scripture:'))
      if(scripture === undefined) {
        return;
      } else {
        scripture.substring('scripture:'.length);
      }
  scripture = capitalizeTitle(scripture.trim());

  let videoId = video.contentDetails.videoId;
  let urlParams = videoId + getTimestampParam(lines);

  let titleArray = video.snippet.title.split(' - ');
  let date_dirty = getDate(titleArray);
  date_dirty = date_dirty === null ? video.contentDetails.videoPublishedAt : date_dirty;
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
 * Takes a request parameter for a particular resource in YouTube and then processes each object in the response
 * in order to create a custom object for a sermon.
 * @param requestParam
 * @returns {Promise<void>}
 */
async function processData(requestParam) {
  let next = true;
  while (requestParam.pageToken || next) {
    await youtube.playlistItems.list(requestParam).then(res => {
      let videos = res.data.items;
      if (videos[0].snippet.title.toLowerCase().includes('morning service') ||
          videos[0].snippet.title.toLowerCase().includes('evening service')) {
        videos.forEach(createLivestreamObject);
      } else {
        videos.forEach(createSermonObject);
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

/**
 * Gets Spotify API access to retrieve url and apply it to the relevant sermon object.
 */
await spotify.clientCredentialsGrant().then(res => {
  spotify.setAccessToken(res.body.access_token);
  return spotify.getShow(gbcPodcastId, {market: 'ES'});
}).then(res => {
  let episodes = res.body.episodes.items;
  episodes.forEach(episode => {
    let title = episode.name.split('-', 1)[0].trim();
    let link = episode.external_urls.spotify;

    let index = data.sermons.findIndex(sermon => sermon.title.toLowerCase() === title.toLowerCase());
    if(index != -1) {
      data.sermons[index].spotifyURL = link;
    }
  });
}).catch(err => {
  console.log(err);
});

let sermonRequestParam = createRequestParam(sermonPlaylistId); //creates YouTube request parameter for sermon playlist.
let livestreamRequestParam = createRequestParam(livestreamPlaylistId); //creates YouTube request parameter for livestream playlist.


await processData(sermonRequestParam);
await processData(livestreamRequestParam);
