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
import type { Channel } from './channel';

/**
 * 
 * @export
 * @interface ChannelActivity
 */
export interface ChannelActivity {
    /**
     * 
     * @type {string}
     * @memberof ChannelActivity
     */
    'object': ChannelActivityObjectEnum;
    /**
     * 
     * @type {string}
     * @memberof ChannelActivity
     */
    'cast_count_1d': string;
    /**
     * 
     * @type {string}
     * @memberof ChannelActivity
     */
    'cast_count_7d': string;
    /**
     * 
     * @type {string}
     * @memberof ChannelActivity
     */
    'cast_count_30d': string;
    /**
     * 
     * @type {Channel}
     * @memberof ChannelActivity
     */
    'channel': Channel;
}

export const ChannelActivityObjectEnum = {
    ChannelActivity: 'channel_activity'
} as const;

export type ChannelActivityObjectEnum = typeof ChannelActivityObjectEnum[keyof typeof ChannelActivityObjectEnum];

