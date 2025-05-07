import { Meteor } from 'meteor/meteor';
import '/imports/api/messages';

// Server-side startup code
Meteor.startup(() => {
  console.log('Server started');
});