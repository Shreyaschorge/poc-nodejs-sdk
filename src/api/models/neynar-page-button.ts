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
import type { NeynarPageButtonNextPage } from './neynar-page-button-next-page';

/**
 * 
 * @export
 * @interface NeynarPageButton
 */
export interface NeynarPageButton {
    /**
     * The title of the button.
     * @type {string}
     * @memberof NeynarPageButton
     */
    'title': string;
    /**
     * The index of the button, first button should have index 1 and so on.
     * @type {number}
     * @memberof NeynarPageButton
     */
    'index': number;
    /**
     * The type of action that the button performs.
     * @type {string}
     * @memberof NeynarPageButton
     */
    'action_type': NeynarPageButtonActionTypeEnum;
    /**
     * 
     * @type {NeynarPageButtonNextPage}
     * @memberof NeynarPageButton
     */
    'next_page'?: NeynarPageButtonNextPage;
}

export const NeynarPageButtonActionTypeEnum = {
    Post: 'post',
    PostRedirect: 'post_redirect',
    Mint: 'mint',
    Link: 'link'
} as const;

export type NeynarPageButtonActionTypeEnum = typeof NeynarPageButtonActionTypeEnum[keyof typeof NeynarPageButtonActionTypeEnum];

