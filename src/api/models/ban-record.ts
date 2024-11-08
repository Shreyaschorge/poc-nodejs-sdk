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
import type { User } from './user';

/**
 * 
 * @export
 * @interface BanRecord
 */
export interface BanRecord {
    /**
     * 
     * @type {string}
     * @memberof BanRecord
     */
    'object': BanRecordObjectEnum;
    /**
     * 
     * @type {User}
     * @memberof BanRecord
     */
    'banned'?: User;
    /**
     * 
     * @type {string}
     * @memberof BanRecord
     */
    'banned_at': string;
}

export const BanRecordObjectEnum = {
    Ban: 'ban'
} as const;

export type BanRecordObjectEnum = typeof BanRecordObjectEnum[keyof typeof BanRecordObjectEnum];


