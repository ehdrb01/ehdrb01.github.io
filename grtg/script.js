// Edit these names for your real roster.
const PARTICIPANTS = [
  "하경한",
  "한영재",
  "이동혁",
  "박초은",
  "김지혜",
  "박연우",
  "김지영",
  "허신혜",
  "고경민",
  "이효정",
  "박준수",
  "이예진",
  "이세은",
  "장영광",
  "김병준",
  "권종현",
  "최재근",
  "양승권",
  "김동현",
  "이찬희",
  "이준표",
  "이진성",
  "이정배",
  "황주원",
  "강서진",
  "이희재",
  "박주은",
  "장은기",
  "조기진",
  "조경찬",
  "김동규",
  "김동해",
  "김현우",
  "김신영",
  "노연교",
  "김지훈",
  "김지수(98)",
  "김지수(02)",
  "류태경",
  "윤은비",
  "이상준"
];

const LATE_PARTICIPANTS = ["박초은", "김지수(98)", "이찬희", "황주원", "류태경", "윤은비", "김지수(02)", "이상준"];

const LEADER_BLOCKLIST = ["이희재", "김동규", "이세은", "박연우", "이예진", "박주은", "노연교", "조경찬", "장영광"];

const MAX_ATTEMPTS = 900;

const state = {
  mode: "size",
  groups: [],
};

const elements = {
  totalCount: document.querySelector("#totalCount"),
  peopleList: document.querySelector("#peopleList"),
  lateNote: document.querySelector("#lateNote"),
  groupValue: document.querySelector("#groupValue"),
  groupValueLabel: document.querySelector("#groupValueLabel"),
  shuffleButton: document.querySelector("#shuffleButton"),
  resetButton: document.querySelector("#resetButton"),
  groupsGrid: document.querySelector("#groupsGrid"),
  resultTitle: document.querySelector("#resultTitle"),
  statusPill: document.querySelector("#statusPill"),
  modeButtons: document.querySelectorAll(".segment"),
};

function shuffle(items) {
  const copied = [...items];

  for (let index = copied.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copied[index], copied[randomIndex]] = [copied[randomIndex], copied[index]];
  }

  return copied;
}

function validateRoster() {
  const names = new Set(PARTICIPANTS);
  const duplicateNames = PARTICIPANTS.filter((name, index) => PARTICIPANTS.indexOf(name) !== index);
  const unknownLateNames = LATE_PARTICIPANTS.filter((name) => !names.has(name));
  const unknownLeaderBlockedNames = LEADER_BLOCKLIST.filter((name) => !names.has(name));

  if (duplicateNames.length > 0) {
    console.warn("Duplicate participant names:", [...new Set(duplicateNames)]);
  }

  if (unknownLateNames.length > 0) {
    console.warn("Unknown names in LATE_PARTICIPANTS:", [...new Set(unknownLateNames)]);
  }

  if (unknownLeaderBlockedNames.length > 0) {
    console.warn("Unknown names in LEADER_BLOCKLIST:", [...new Set(unknownLeaderBlockedNames)]);
  }
}

function getTargetSizes() {
  const total = PARTICIPANTS.length;
  const rawValue = Number.parseInt(elements.groupValue.value, 10);
  const value = Number.isFinite(rawValue) ? rawValue : 2;

  if (state.mode === "size") {
    const groupSize = clamp(value, 2, total);
    const groupCount = Math.ceil(total / groupSize);
    return distributeSizes(total, groupCount);
  }

  const groupCount = clamp(value, 1, total);
  return distributeSizes(total, groupCount);
}

function distributeSizes(total, groupCount) {
  const baseSize = Math.floor(total / groupCount);
  const largerGroups = total % groupCount;

  return Array.from({ length: groupCount }, (_, index) => {
    return baseSize + (index < largerGroups ? 1 : 0);
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildGroups(targetSizes) {
  const latePeople = new Set(LATE_PARTICIPANTS);
  const leaderBlockedPeople = new Set(LEADER_BLOCKLIST);
  let bestGroups = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const groups = targetSizes.map((size) => ({ targetSize: size, members: [] }));
    const orderedPeople = shuffle(PARTICIPANTS).sort((a, b) => {
      return (
        Number(isLeaderEligible(b, latePeople, leaderBlockedPeople)) -
          Number(isLeaderEligible(a, latePeople, leaderBlockedPeople)) ||
        Number(latePeople.has(b)) - Number(latePeople.has(a))
      );
    });

    if (placePerson(orderedPeople, 0, groups, latePeople, leaderBlockedPeople)) {
      const candidateGroups = groups.map((group) =>
        orderMembersForLeadership(group.members, latePeople, leaderBlockedPeople),
      );
      const score = scoreGroups(candidateGroups, latePeople, leaderBlockedPeople);

      if (score < bestScore) {
        bestGroups = candidateGroups;
        bestScore = score;
      }

      if (bestScore === 0) {
        return bestGroups;
      }
    }
  }

  return bestGroups;
}

function placePerson(people, personIndex, groups, latePeople, leaderBlockedPeople) {
  if (personIndex >= people.length) {
    return true;
  }

  const person = people[personIndex];
  const candidateIndexes = shuffle(groups.map((_, index) => index)).sort((a, b) => {
    const leaderPenaltyA = leadershipPlacementPenalty(person, groups[a], latePeople, leaderBlockedPeople);
    const leaderPenaltyB = leadershipPlacementPenalty(person, groups[b], latePeople, leaderBlockedPeople);
    const latePenaltyA = latePeople.has(person) ? countLateMembers(groups[a].members, latePeople) : 0;
    const latePenaltyB = latePeople.has(person) ? countLateMembers(groups[b].members, latePeople) : 0;

    return (
      leaderPenaltyA - leaderPenaltyB ||
      latePenaltyA - latePenaltyB ||
      remainingSpace(groups[b]) - remainingSpace(groups[a])
    );
  });

  for (const groupIndex of candidateIndexes) {
    const group = groups[groupIndex];

    if (!canPlace(group)) {
      continue;
    }

    group.members.push(person);

    if (placePerson(people, personIndex + 1, groups, latePeople, leaderBlockedPeople)) {
      return true;
    }

    group.members.pop();
  }

  return false;
}

function remainingSpace(group) {
  return group.targetSize - group.members.length;
}

function canPlace(group) {
  return group.members.length < group.targetSize;
}

function countLateMembers(members, latePeople) {
  return members.filter((member) => latePeople.has(member)).length;
}

function scoreLateSpread(groups, latePeople) {
  return groups.reduce((score, group) => {
    const lateCount = countLateMembers(group, latePeople);
    return score + (lateCount * (lateCount - 1)) / 2;
  }, 0);
}

function scoreGroups(groups, latePeople, leaderBlockedPeople) {
  return scoreLeaderCoverage(groups, latePeople, leaderBlockedPeople) * 1000 + scoreLateSpread(groups, latePeople);
}

function scoreLeaderCoverage(groups, latePeople, leaderBlockedPeople) {
  return groups.filter((group) => !hasLeaderEligibleMember(group, latePeople, leaderBlockedPeople)).length;
}

function hasLeaderEligibleMember(members, latePeople, leaderBlockedPeople) {
  return members.some((member) => isLeaderEligible(member, latePeople, leaderBlockedPeople));
}

function leadershipPlacementPenalty(person, group, latePeople, leaderBlockedPeople) {
  const groupAlreadyHasLeaderCandidate = hasLeaderEligibleMember(
    group.members,
    latePeople,
    leaderBlockedPeople,
  );

  if (isLeaderEligible(person, latePeople, leaderBlockedPeople)) {
    return groupAlreadyHasLeaderCandidate ? 1 : 0;
  }

  return groupAlreadyHasLeaderCandidate ? 0 : 1;
}

function isLeaderEligible(person, latePeople, leaderBlockedPeople) {
  return !latePeople.has(person) && !leaderBlockedPeople.has(person);
}

function orderMembersForLeadership(members, latePeople, leaderBlockedPeople) {
  const shuffledMembers = shuffle(members);
  const leaderIndex = shuffledMembers.findIndex((member) =>
    isLeaderEligible(member, latePeople, leaderBlockedPeople),
  );

  if (leaderIndex <= 0) {
    return shuffledMembers;
  }

  const [leader] = shuffledMembers.splice(leaderIndex, 1);
  return [leader, ...shuffledMembers];
}

function topicParticle(text) {
  const lastCharacter = text.trim().at(-1);

  if (!lastCharacter) {
    return "는";
  }

  const code = lastCharacter.charCodeAt(0);
  const hangulStart = 0xac00;
  const hangulEnd = 0xd7a3;

  if (code < hangulStart || code > hangulEnd) {
    return "는";
  }

  return (code - hangulStart) % 28 === 0 ? "는" : "은";
}

function renderPeople() {
  const latePeople = new Set(LATE_PARTICIPANTS);
  const lateNames = PARTICIPANTS.filter((person) => latePeople.has(person));

  elements.totalCount.textContent = PARTICIPANTS.length;
  elements.peopleList.innerHTML = "";
  elements.lateNote.textContent =
    lateNames.length > 0
      ? `* ${lateNames.join(", ")}${topicParticle(lateNames.at(-1))} 늦게 오는 사람입니다.`
      : "";
  elements.lateNote.classList.toggle("is-hidden", lateNames.length === 0);

  PARTICIPANTS.forEach((person) => {
    const chip = document.createElement("span");
    chip.className = `person-chip${latePeople.has(person) ? " is-late" : ""}`;
    chip.textContent = person;
    elements.peopleList.append(chip);
  });
}

function renderGroups(groups) {
  const latePeople = new Set(LATE_PARTICIPANTS);
  const leaderBlockedPeople = new Set(LEADER_BLOCKLIST);

  elements.groupsGrid.innerHTML = "";

  groups.forEach((members, index) => {
    const card = document.createElement("article");
    card.className = "group-card";

    const title = document.createElement("div");
    title.className = "group-title";

    const heading = document.createElement("h3");
    heading.textContent = `${index + 1}조`;

    const count = document.createElement("span");
    count.className = "member-count";
    count.textContent = `${members.length}명`;

    const list = document.createElement("ul");
    list.className = "member-list";

    members.forEach((member, memberIndex) => {
      const item = document.createElement("li");
      const isLeader = memberIndex === 0 && isLeaderEligible(member, latePeople, leaderBlockedPeople);
      const isLate = latePeople.has(member);

      item.classList.toggle("is-late", isLate);
      item.classList.toggle("has-badge", isLeader || isLate);

      const badgeSlot = document.createElement("span");
      badgeSlot.className = "member-badge-slot";

      if (isLeader) {
        const leaderBadge = document.createElement("span");
        leaderBadge.className = "leader-badge";
        leaderBadge.textContent = "조장";
        badgeSlot.append(leaderBadge);
      }

      if (isLate) {
        const lateBadge = document.createElement("span");
        lateBadge.className = "late-badge";
        lateBadge.textContent = "늦참";
        badgeSlot.append(lateBadge);
      }

      const memberName = document.createElement("span");
      memberName.className = "member-name";
      memberName.textContent = member;

      if (isLeader || isLate) {
        item.append(badgeSlot, memberName);
      } else {
        item.append(memberName);
      }

      list.append(item);
    });

    title.append(heading, count);
    card.append(title, list);
    elements.groupsGrid.append(card);
  });
}

function setStatus(kind, title, pillText) {
  elements.resultTitle.textContent = title;
  elements.statusPill.textContent = pillText;
  elements.statusPill.classList.toggle("is-error", kind === "error");
}

function assignGroups() {
  const targetSizes = getTargetSizes();
  const groups = buildGroups(targetSizes);

  if (!groups) {
    state.groups = [];
    elements.groupsGrid.innerHTML = "";
    setStatus("error", "조건을 만족하는 배정을 찾지 못했습니다", "실패");
    return;
  }

  state.groups = groups;
  renderGroups(groups);
  setStatus("success", `${groups.length}개 조 배정 완료`, "완료");
}

function resetGroups() {
  state.groups = [];
  elements.groupsGrid.innerHTML = "";
  setStatus("idle", "아직 배정 전입니다", "대기");
}

function setMode(nextMode) {
  state.mode = nextMode;

  elements.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === nextMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  if (nextMode === "size") {
    elements.groupValueLabel.textContent = "한 조당 인원";
    elements.groupValue.value = "4";
    elements.groupValue.min = "2";
  } else {
    elements.groupValueLabel.textContent = "만들 조 개수";
    elements.groupValue.value = "5";
    elements.groupValue.min = "1";
  }

  resetGroups();
}

function bindEvents() {
  elements.shuffleButton.addEventListener("click", assignGroups);
  elements.resetButton.addEventListener("click", resetGroups);

  elements.groupValue.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      assignGroups();
    }
  });

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
}

validateRoster();
renderPeople();
bindEvents();
