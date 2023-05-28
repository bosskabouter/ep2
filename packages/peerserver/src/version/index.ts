import { execSync } from "child_process";

const git_command = "git reverse-parse HEAD";
export default () => {
  return execSync(git_command).toString().trim();
};
