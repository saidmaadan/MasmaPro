const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');
const Schema = mongoose.Schema;

const listingSchema = new Schema({
  listingTypes:{
    type: [String],
    trim: true,
    require: "Please Select Your Listing Type, For Rent or For Sale"
  },

  title: {
    type: String,
    trim: true,
    required: "Please enter title for your listing"
  },
  description:{
    type: String,
    trim: true,
    required: "Please enter some description for your listing"
  },
  pic: [String],
  slug: String,
  propertyTypes: [String],
  bedrooms: String,
  bathrooms: String,
  year: String,
  price: String,
  rent: String,
  rentOptions: [String],
  squareFeet: String,
  numberOfFloors: String,
  garageSize: String,

  propertyFeatures: [String],
  lotFeatures: [String],
  lotSize: String,
  communityFeatures: [String],

  created: {
    type: Date,
    default: Date.now
  },

  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author'
  },
  states: {
    type: String,
    required: "Please select State"
  },

  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [
      {
        type: Number,
        required: "You must supply coordinates"
      }
    ],
    address: {
      type: String,
      required: 'You must supply an address!'
    }
  }

},
{
  toJSON: {virtuals: true},
  toObject: {virtuals: true}
});

listingSchema.pre('save', async function(next){
  if (!this.isModified('title')){
    next();
    return;
  }
  this.slug = slug(this.title);
  // find other listings with the same title as slug
  const slugRegExp = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const listingWithSlug = await this.constructor.find({slug: slugRegExp});
  if(listingWithSlug.length){
    this.slug = `${this.slug}-${listingWithSlug.length + 1}`
  }
  next();
});

listingSchema.statics.getListingTypesList = function(){
  return this.aggregate([
    { $unwind: '$listingTypes' },
    { $group: { _id: '$listingTypes', count: { $sum: 1} }},
    { $sort: { count: -1 }}
  ]);
};

listingSchema.statics.getListingStatesList = function(){
  return this.aggregate([
    { $unwind: '$states' },
    { $group: { _id: '$states', count: { $sum: 1} }},
    { $sort: { count: -1 }}
  ]);
};

listingSchema.statics.getTopListings = function(){
  return this.aggregate([
    //lookup for listings and populate their reviews
    { $lookup: {
      from: 'reviews',
      localField: '_id',
      foreignField: 'listing', as: 'reviews'
     }
   },
   // filter for listings with 2 or more reviews
   { $match: { 'reviews.1': { $exists: true }}},
   // Add the average reviews field
   { $project: {
     pic: '$$ROOT.pic',
     title: '$$ROOT.title',
     reviews: '$$ROOT.reviews',
     slug: '$$ROOT.slug',
     averageRating: { $avg: '$reviews.rating' }
   }},
   // sort by highest reviews
   { $sort: { averageRating: -1 }},
   // limit to specific numbers
   { $limit: 10 }
 ]);
}

//find reviews where the listings _id property equal reviews listing property
listingSchema.virtual('reviews', {
  ref: 'Review', //what model to link?
  localField: '_id', // which field on the listing?
  foreignField: 'listing' // which field on the review?
});

function autopopulate(next){
  this.populate('reviews');
  next();
}

listingSchema.pre('find', autopopulate);
listingSchema.pre('findOne', autopopulate);



module.exports = mongoose.model('Listing', listingSchema);
