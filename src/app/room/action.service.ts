/*
 * Copyright (C) 2015 SUSE Linux
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

import * as _ from "lodash";

import { Injectable } from "@angular/core";

import { Broadcaster } from "../shared";
import { Feed, FeedsService } from "../feed";
import { DataChannelService } from "./data-channel.service";
import { LogService } from "./log.service";

import { Message, generateMessage } from "../models/message";

@Injectable()
export class ActionService {

  constructor(private feeds: FeedsService,
              private dataChannel: DataChannelService,
              private logService: LogService,
              private broadcaster: Broadcaster
  ) { }

  public enterRoom(feedId: number, display: any, connection: any): void {
    let feed: Feed = new Feed();
    feed.setAttrs({
      display: display,
      connection: connection,
      id: feedId,
      isPublisher: true,
      dataChannel: this.dataChannel
    });
    this.feeds.add(feed, {main: true});
  }

  public leaveRoom(): void {
    _.forEach(this.feeds.allFeeds(), (feed) => {
      this.destroyFeed(feed.id);
    });
  }

  public publishScreen(feedId: number, display: any, connection: any): void {
    let feed: Feed = new Feed();
    feed.setAttrs({
      display: display,
      connection: connection,
      id: feedId,
      isPublisher: true,
      isLocalScreen: true,
      dataChannel: this.dataChannel
    });
    this.feeds.add(feed);

    this.log({type: "publishScreen"})
  }

  public remoteJoin(feedId: number, display: any, connection: any): void {
    let feed: Feed = new Feed();
    feed.setAttrs({
      display: display,
      connection: connection,
      id: feedId,
      isPublisher: false,
      dataChannel: this.dataChannel
    });
    this.feeds.add(feed);
    this.log({type: "newRemoteFeed", feed});
  }

  public destroyFeed(feedId: number): void {
    let feed: Feed = this.feeds.find(feedId);
    if (feed === null) { return; }

    feed.disconnect();
    this.feeds.destroy(feedId);

    this.log({type: "destroyFeed", feed});
  }

  public ignoreFeed(feedId: number): void {
    let feed: Feed = this.feeds.find(feedId);
    if (feed === null) { return; }
    feed.ignore();

    this.log({type: "ignoreFeed", feed});
  }

  public stopIgnoringFeed(feedId: number, connection: any): void {
    let feed: Feed = this.feeds.find(feedId);
    if (feed === null) { return; }
    feed.stopIgnoring(connection);

    this.log({type: "stopIgnoringFeed", feed});
  }

  public writeChatMessage(text: string): Message {
    const feed = this.feeds.findMain();
    this.dataChannel.sendChatMessage(text);
    return generateMessage({type: "chatMsg", feed, text});
  }

  public toggleChannel(type: string, feed: Feed = undefined): void {
    /*
     * If no feed is provided, we are muting ourselves
     */
    if (!feed) {
      feed = this.feeds.findMain();
      if (!feed) { return; }
    }

    if (!feed.isPublisher) {
      this.log({type: "muteRequest", source: this.feeds.findMain(), target: feed});
    }

    if (feed.isEnabled(type)) {
      let callback: any = null;
      /*
       * If we are muting the main feed (the only publisher that can be
       * actually muted) raise a signal
       */
      if (type === "audio" && feed.isPublisher) {
        callback = (): void => {
          this.broadcaster.broadcast("muted.byUser");
        };
      }
      feed.setEnabledChannel(type, false, {after: callback});
    } else {
      feed.setEnabledChannel(type, true);
    }
  }

  /**
   * Disable or enable audio or video for the main feed
   */
  public setMedia(type: string, boolval: boolean): void {
    let feed: Feed = this.feeds.findMain();
    if (!feed) { return; }

    feed.setEnabledChannel(type, boolval);
  }

  private log(data): void {
    this.logService.log(data);
  }
}
