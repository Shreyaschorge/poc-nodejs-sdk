/* tslint:disable */
/* eslint-disable */
/**
 * Farcaster API V2
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 2.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


// May contain unused imports in some cases
// @ts-ignore
import type { ChannelMemberRole } from './channel-member-role';

/**
 * 
 * @export
 * @interface RemoveChannelMemberRequest
 */
export interface RemoveChannelMemberRequest {
    /**
     * UUID of the signer
     * @type {string}
     * @memberof RemoveChannelMemberRequest
     */
    'signer_uuid': string;
    /**
     * The unique identifier of a farcaster channel
     * @type {string}
     * @memberof RemoveChannelMemberRequest
     */
    'channel_id': string;
    /**
     * The unique identifier of a farcaster user (unsigned integer)
     * @type {number}
     * @memberof RemoveChannelMemberRequest
     */
    'fid': number;
    /**
     * 
     * @type {ChannelMemberRole}
     * @memberof RemoveChannelMemberRequest
     */
    'role': ChannelMemberRole;
}


