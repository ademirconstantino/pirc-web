import { describe, expect, it } from 'vitest';
import { END_OF_NAMES, NAM_REPLY, WELCOME } from './constants';
import { IrcMessage } from './IrcMessage';

/* port of IrcMessageTest.java */
describe('IrcMessage', () => {
  const parse = (line: string) => IrcMessage.parse(line)!;

  it('parses a message without prefix', () => {
    const m = parse('PING :irc.brasnet.org');
    expect(m.prefix).toBe('');
    expect(m.command).toBe('PING');
    expect(m.trailing()).toBe('irc.brasnet.org');
  });

  it('parses the prefix', () => {
    const m = parse(':nick!user@host PRIVMSG #pirc :hello world');
    expect(m.nick()).toBe('nick');
    expect(m.host()).toBe('user@host');
    expect(m.param(0)).toBe('#pirc');
    expect(m.trailing()).toBe('hello world');
  });

  it('makes the command upper case', () => {
    expect(parse('ping :x').command).toBe('PING');
  });

  it('server prefix has no host', () => {
    const m = parse(':irc.server.org NOTICE * :*** Looking up your hostname');
    expect(m.nick()).toBe('irc.server.org');
    expect(m.host()).toBe('');
  });

  it('parses numeric replies', () => {
    const m = parse(':srv 353 me = #pirc :@op +voice user');
    expect(m.isNumeric()).toBe(true);
    expect(m.numeric()).toBe(NAM_REPLY);
    expect(m.param(2)).toBe('#pirc');
    expect(m.trailing()).toBe('@op +voice user');
    expect(m.paramsFrom(1)).toBe('= #pirc @op +voice user');
    expect(parse(':srv 001 me :Welcome').numeric()).toBe(WELCOME);
    expect(parse(':srv 366 me #pirc :End of /NAMES list.').numeric()).toBe(END_OF_NAMES);
  });

  it('commands are not numeric', () => {
    const m = parse('JOIN #pirc');
    expect(m.isNumeric()).toBe(false);
    expect(m.numeric()).toBe(-1);
  });

  it('parses JOIN with or without colon', () => {
    expect(parse(':a!b@c JOIN :#pirc').param(0)).toBe('#pirc');
    expect(parse(':a!b@c JOIN #pirc').param(0)).toBe('#pirc');
  });

  it('missing params are empty', () => {
    const m = parse(':a!b@c QUIT');
    expect(m.trailing()).toBe('');
    expect(m.param(3)).toBe('');
    expect(m.param(-1)).toBe('');
    expect(m.paramsFrom(1)).toBe('');
  });

  it('parses KICK without reason', () => {
    const m = parse(':op!b@c KICK #pirc victim');
    expect(m.param(1)).toBe('victim');
    expect(m.param(2)).toBe('');
  });

  it('keeps an empty trailing', () => {
    expect(parse(':srv TOPIC #pirc :').params).toEqual(['#pirc', '']);
  });

  it('collapses repeated spaces', () => {
    const m = parse(':srv  MODE  #pirc  +o  nick');
    expect(m.command).toBe('MODE');
    expect(m.paramsFrom(1)).toBe('+o nick');
  });

  it('returns null for invalid lines', () => {
    expect(IrcMessage.parse('')).toBeNull();
    expect(IrcMessage.parse('   ')).toBeNull();
    expect(IrcMessage.parse(':prefixonly')).toBeNull();
  });
});
