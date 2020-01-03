import test from 'ava';
import { wavematch } from '../dist/wavematch.cjs.development';

class Notification {}
class Email extends Notification {}
class Text extends Notification {}
class VoiceMsg extends Notification {}

const notification = new Notification();
const email = new Email();
const text = new Text();
const voiceMsg = new VoiceMsg();

test('named class', t => {
    wavematch(notification)(
        (x = Notification) => t.pass(),
        _ => t.fail()
    );
    wavematch(notification)(
        (x = Email) => t.fail(),
        (x = Text) => t.fail(),
        (x = VoiceMsg) => t.fail(),
        (x = Notification) => t.pass(),
        _ => t.fail()
    );
    wavematch(email)(
        (x = Email) => t.pass(),
        _ => t.fail()
    );
    wavematch(text)(
        (x = Text) => t.pass(),
        _ => t.fail()
    );
    wavematch(voiceMsg)(
        (x = VoiceMsg) => t.pass(),
        _ => t.fail()
    );
});

test('named subclass', t => {
    wavematch(email)(
        (x = Notification) => t.pass(),
        _ => t.fail()
    );
    wavematch(text)(
        (x = Notification) => t.pass(),
        _ => t.fail()
    );
});
