/**
 * Techi Calling Agent
 * Matches spoken contacts from contacts.json and opens native phone dialer via tel:
 */
class CallAgent {
  constructor(speaker) {
    this.speaker = speaker;
    this.contacts = [];
    this.waitingForContactName = false;
    this.loadContacts();
  }

  async loadContacts() {
    try {
      const res = await fetch('/api/contacts');
      this.contacts = await res.json();
      console.log('[CallAgent] Loaded contacts:', this.contacts.length);
    } catch (err) {
      console.error('[CallAgent] Failed to load contacts:', err);
    }
  }

  async findContact(query) {
    if (!this.contacts || this.contacts.length === 0) {
      await this.loadContacts();
    }

    const clean = query
      .toLowerCase()
      .replace(/(\-ku|ku|kku|ukku|oda|oda|call|phone|dial|pannu|podu)\b/gi, '')
      .trim();

    // 1. Direct name match
    let matched = this.contacts.find(c => c.name.toLowerCase() === clean);

    // 2. Alias match
    if (!matched) {
      matched = this.contacts.find(c =>
        c.aliases && c.aliases.some(a => a.toLowerCase() === clean || clean.includes(a.toLowerCase()))
      );
    }

    // 3. Substring match
    if (!matched) {
      matched = this.contacts.find(c =>
        c.name.toLowerCase().includes(clean) || clean.includes(c.name.toLowerCase())
      );
    }

    return matched;
  }

  async handleCallCommand(input) {
    // If we were waiting for the contact name from a previous question
    if (this.waitingForContactName) {
      this.waitingForContactName = false;
      return this.callByName(input);
    }

    // Extract target name from command (e.g. "amma-ku call pannu" -> "amma")
    let target = input
      .replace(/(call|phone|dial|podu|pannu)/gi, '')
      .replace(/(\-ku|ku|kku|ukku)/gi, '')
      .trim();

    return this.callByName(target);
  }

  async callByName(name) {
    const contact = await this.findContact(name);

    if (contact) {
      this.speaker.speak(`${contact.name}-ku call panren boss.`);

      // Trigger dialer
      setTimeout(() => {
        try {
          const a = document.createElement('a');
          a.href = `tel:${contact.number}`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 500);
        } catch (e) {
          console.error('[CallAgent] Dial error:', e);
        }
      }, 1200);

      return true;
    } else {
      this.waitingForContactName = true;
      this.speaker.speak(`Andha name contacts list-la illai boss. Yaarukku call pannanum nu sollunga?`);
      return false;
    }
  }
}

window.CallAgent = CallAgent;
