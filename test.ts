import { CastComposerType, CastParamType } from "./src/api/models";
import { NeynarAPIClient } from "./src/generated/NeynarAPIClient";

const client = new NeynarAPIClient("ntest");

const fids = [4, 6, 1, 191];
// const viewer_fid = 8;

const identifier = "https://warpcast.com/harper.eth/0x3c974d78";
const type = CastParamType.Url;
const viewer_fid = 2345;


const signer_uuid = "c06aa219-65ed-477f-b461-3e2fd70a36a7";
const text = 'Hello, World! test sdk v2'
const embeds = [{
  url: 'https://warpcast.com/harper.eth/0x3c974d78',
}]

client.publishCast({signer_uuid, text, embeds}).then(response => {
  console.log('response:', response);
});