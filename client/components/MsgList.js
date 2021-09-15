import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useQueryClient, useMutation, useInfiniteQuery } from "react-query";
import MsgItem from "./MsgItem";
import MsgInput from "./MsgInput";
import {
  QueryKeys,
  fetcher,
  findTargetMsgIndex,
  getNewMessages,
} from "../queryClient";
import {
  GET_MESSAGES,
  CREATE_MESSAGE,
  UPDATE_MESSAGE,
  DELETE_MESSAGE,
} from "../graphql/message";
import useInfiniteScroll from "../hooks/useInfiniteScroll";

const MsgList = ({ smsgs }) => {
  const client = useQueryClient();
  const {
    query: { userId = "" },
  } = useRouter();
  const [msgs, setMsgs] = useState([{ messages: smsgs }]);
  const [editingId, setEditingId] = useState(null);
  const fetchMoreEl = useRef(null);
  const intersecting = useInfiniteScroll(fetchMoreEl);
  // const [hasNext, setHasNext] = useState(true);

  // const onCreate = async (text) => {
  //   const newMsg = await fetcher("post", "/messages", { text, userId });
  //   if (!newMsg) throw Error("something wrong");
  //   setMsgs((msgs) => [newMsg, ...msgs]);
  // };

  const { mutate: onCreate } = useMutation(
    ({ text }) => fetcher(CREATE_MESSAGE, { text, userId }),
    {
      onSuccess: ({ createMessage }) => {
        client.setQueryData(QueryKeys.MESSAGES, (old) => {
          return {
            pageParam: old.pageParam,
            pages: [
              { messages: [createMessage, ...old.pages[0].messages] },
              ...old.pages.slice(1),
            ],
          };
        });
      },
    }
  );

  // const onUpdate = async (text, id) => {
  //   const newMsg = await fetcher("put", `/messages/${id}`, { text, userId });
  //   if (!newMsg) throw Error("something wrong");
  //   setMsgs((msgs) => {
  //     const targetIndex = msgs.findIndex((msg) => msg.id === id);
  //     if (targetIndex < 0) return msgs;
  //     const newMsgs = [...msgs];
  //     newMsgs.splice(targetIndex, 1, newMsg);
  //     return newMsgs;
  //   });
  //   doneEdit();
  // };

  const { mutate: onUpdate } = useMutation(
    ({ text, id }) => fetcher(UPDATE_MESSAGE, { text, id, userId }),
    {
      onSuccess: ({ updateMessage }) => {
        doneEdit();
        client.setQueryData(QueryKeys.MESSAGES, (old) => {
          const { pageIndex, msgIndex } = findTargetMsgIndex(
            old.pages,
            updateMessage.id
          );
          if (pageIndex < 0 || msgIndex < 0) return old;
          const newMsgs = getNewMessages(old);
          newMsgs.pages[pageIndex].messages.splice(msgIndex, 1, updateMessage);
          return newMsgs;
        });
      },
    }
  );

  // const onDelete = async (id) => {
  //   const receivedId = await fetcher("delete", `/messages/${id}`, {
  //     params: { userId },
  //   });
  //   setMsgs((msgs) => {
  //     const targetIndex = msgs.findIndex((msg) => msg.id === receivedId + "");
  //     if (targetIndex < 0) return msgs;
  //     const newMsgs = [...msgs];
  //     newMsgs.splice(targetIndex, 1);
  //     return newMsg;
  //   });
  // };

  const { mutate: onDelete } = useMutation(
    (id) => fetcher(DELETE_MESSAGE, { id, userId }),
    {
      onSuccess: ({ deleteMessage: deletedId }) => {
        client.setQueryData(QueryKeys.MESSAGES, (old) => {
          const { pageIndex, msgIndex } = findTargetMsgIndex(
            old.pages,
            deletedId
          );
          if (pageIndex < 0 || msgIndex < 0) return old;

          const newMsgs = getNewMessages(old);
          newMsgs.pages[pageIndex].messages.splice(msgIndex, 1);
          return newMsgs;
        });
      },
    }
  );

  const doneEdit = () => setEditingId(null);

  // const getMessages = async () => {
  //   const newMsgs = await fetcher("get", "/messages", {
  //     params: { cursor: msgs[msgs.length - 1]?.id || "" },
  //   });
  //   if (newMsgs.length === 0) {
  //     setHasNext(false);
  //     return;
  //   }
  //   setMsgs((msgs) => [...msgs, ...newMsgs]);
  // };

  const { data, error, isError, fetchNextPage, hasNextPage } = useInfiniteQuery(
    QueryKeys.MESSAGES,
    ({ pageParam = "" }) => fetcher(GET_MESSAGES, { cursor: pageParam }),
    {
      getNextPageParam: ({ messages }) => {
        return messages?.[messages.length - 1]?.id;
      },
    }
  );

  useEffect(() => {
    if (!data?.pages) return;
    // const mergedMsgs = data.pages.flatMap((d) => d.messages);
    setMsgs(data.pages);
  }, [data?.pages]);

  if (isError) {
    console.error(error);
    return null;
  }

  useEffect(() => {
    if (intersecting && hasNextPage) fetchNextPage();
  }, [intersecting, hasNextPage]);

  return (
    <>
      {userId && <MsgInput mutate={onCreate} />}
      <ul className="messages">
        {msgs.map(({ messages }) =>
          messages.map((x) => (
            <MsgItem
              key={x.id}
              {...x}
              onUpdate={onUpdate}
              onDelete={() => onDelete(x.id)}
              startEdit={() => setEditingId(x.id)}
              isEditing={editingId === x.id}
              myId={userId}
            />
          ))
        )}
      </ul>
      <div ref={fetchMoreEl} />
    </>
  );
};

export default MsgList;
