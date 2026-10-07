# Part 1: Overreliance and Trust Calibration

The main thing I've learned is that a review interface has one core job: help the person using it decide how much to trust the data in front of them. That cuts both ways. If people trust the AI too much, bad data gets approved because nothing made them stop and look. If they trust it too little, they start redoing the work by hand, or they quietly stop using the tool. Either way the tool fails. The goal is "trust calibration": trust that matches how reliable the output actually is, item by item.

Overreliance usually isn't about the reviewer lacking expertise. It happens because the interface made agreeing easier than checking. A very accurate model can still get rubber-stamped if the screen makes disagreeing slow or awkward. The interface decides how much effort it costs to push back.

A one-click "approve all," a sort order that gets people into a rhythm of agreeing on easy items before they hit the hard ones, a system that never admits it's unsure: none of these have anything to do with model quality, and all of them push people toward overreliance.

An example I came across from medical imaging: when AI-suggested areas of concern are highlighted on a mammogram, radiologists tend to focus on those areas and look less carefully at the rest. They can miss things the model also missed that they might have caught on their own. The model wasn't the problem. The display pulled their attention.

The common fixes all have tradeoffs:

- **Showing confidence scores** helps until the score itself becomes the thing people rubber-stamp.
- **Requiring per-item confirmation** instead of batch approval helps until the click becomes a reflex.
- **Having the person answer first** before seeing the AI's answer reduces anchoring, but it's slower and gets cut under time pressure.
- **Audits after the fact** measure the problem, but only catch mistakes after they've gone through.

None of these are solved. Each one trades speed against scrutiny, and over time things drift back toward overreliance as the tool stops feeling new and the volume goes up. A design that feels appropriately careful in week one can feel like pure friction by week twelve, and that's when people start working around it.

*Note on sources: I learned this by working through the research referenced in the exercise with AI tools, rather than reading the original papers in full.*
